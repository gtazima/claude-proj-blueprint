"""
Testes de integração dos endpoints HTTP do módulo Agenda.

Validam que a camada HTTP traduz corretamente entre JSON e o serviço,
incluindo códigos de status, formato dos erros e ordenação das listas.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi.testclient import TestClient


def _create_payload(
    *,
    title: str = "Tarefa",
    scheduled_window_end: datetime | None = None,
    financial_score: int = 0,
    executor: str = "produtor",
) -> dict:
    payload = {
        "title": title,
        "executor": executor,
        "financial_score": financial_score,
    }
    if scheduled_window_end is not None:
        payload["scheduled_window_end"] = scheduled_window_end.isoformat()
    return payload


# --------------------------------------------------------------------------
# Criação
# --------------------------------------------------------------------------


class TestCreateEndpoint:
    def test_creates_with_201(self, client: TestClient):
        response = client.post("/api/tasks", json=_create_payload(title="Aplicar calcário"))
        assert response.status_code == 201

        body = response.json()
        assert body["title"] == "Aplicar calcário"
        assert body["completed_at"] is None
        assert UUID(body["id"])

    def test_rejects_invalid_payload(self, client: TestClient):
        response = client.post("/api/tasks", json={"title": ""})
        assert response.status_code == 422

    def test_rejects_invalid_financial_score(self, client: TestClient):
        response = client.post(
            "/api/tasks",
            json={"title": "x", "financial_score": 99, "executor": "produtor"},
        )
        assert response.status_code == 422


# --------------------------------------------------------------------------
# Listagem ordenada
# --------------------------------------------------------------------------


class TestTodayEndpoint:
    def test_orders_by_priority(self, client: TestClient):
        now = datetime.now(timezone.utc)

        client.post(
            "/api/tasks",
            json=_create_payload(
                title="critical",
                scheduled_window_end=now - timedelta(hours=1),
            ),
        )
        client.post(
            "/api/tasks",
            json=_create_payload(
                title="distant",
                scheduled_window_end=now + timedelta(days=60),
            ),
        )
        client.post("/api/tasks", json=_create_payload(title="no-window"))

        response = client.get("/api/tasks/today")
        assert response.status_code == 200

        items = response.json()
        titles = [i["title"] for i in items]
        assert titles[0] == "critical"
        # Score decrescente
        scores = [i["priority_score"] for i in items]
        assert scores == sorted(scores, reverse=True)

    def test_includes_priority_score_and_undo_flag(self, client: TestClient):
        client.post("/api/tasks", json=_create_payload(title="x"))
        items = client.get("/api/tasks/today").json()
        assert "priority_score" in items[0]
        assert "can_undo_completion" in items[0]


# --------------------------------------------------------------------------
# Conclusão e undo
# --------------------------------------------------------------------------


class TestCompletionEndpoints:
    def test_complete_then_undo(self, client: TestClient):
        created = client.post("/api/tasks", json=_create_payload()).json()
        task_id = created["id"]

        response = client.post(f"/api/tasks/{task_id}/complete")
        assert response.status_code == 200
        assert response.json()["completed_at"] is not None

        response = client.post(f"/api/tasks/{task_id}/uncomplete")
        assert response.status_code == 200
        assert response.json()["completed_at"] is None

    def test_complete_creates_entry_in_completed_today(self, client: TestClient):
        created = client.post("/api/tasks", json=_create_payload(title="ABC")).json()
        client.post(f"/api/tasks/{created['id']}/complete")

        response = client.get("/api/tasks/completed-today")
        assert response.status_code == 200
        titles = [t["title"] for t in response.json()]
        assert "ABC" in titles

    def test_undo_after_lock_returns_409(self, client: TestClient, task_service):
        created = client.post("/api/tasks", json=_create_payload()).json()
        task_id = UUID(created["id"])
        client.post(f"/api/tasks/{task_id}/complete")

        # Simula lock direto no banco
        task = task_service.get(task_id)
        task.completion_locked = True
        task_service.session.add(task)
        task_service.session.commit()

        response = client.post(f"/api/tasks/{task_id}/uncomplete")
        assert response.status_code == 409


# --------------------------------------------------------------------------
# Adiamento
# --------------------------------------------------------------------------


class TestDeferEndpoint:
    def test_defer_with_reason(self, client: TestClient):
        created = client.post("/api/tasks", json=_create_payload()).json()
        new_window = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()

        response = client.post(
            f"/api/tasks/{created['id']}/defer",
            json={
                "new_scheduled_window_start": new_window,
                "reason": "vai chover até sexta",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["deferral_count"] == 1
        assert body["last_deferral_reason"] == "vai chover até sexta"

    def test_repeatedly_deferred_flag(self, client: TestClient):
        created = client.post("/api/tasks", json=_create_payload()).json()
        for i in range(3):
            new_window = (datetime.now(timezone.utc) + timedelta(days=i + 1)).isoformat()
            client.post(
                f"/api/tasks/{created['id']}/defer",
                json={
                    "new_scheduled_window_start": new_window,
                    "reason": f"motivo {i}",
                },
            )
        response = client.get(f"/api/tasks/{created['id']}")
        assert response.json()["repeatedly_deferred"] is True

    def test_defer_completed_returns_400(self, client: TestClient):
        created = client.post("/api/tasks", json=_create_payload()).json()
        client.post(f"/api/tasks/{created['id']}/complete")

        response = client.post(
            f"/api/tasks/{created['id']}/defer",
            json={
                "new_scheduled_window_start": datetime.now(timezone.utc).isoformat(),
                "reason": "x",
            },
        )
        assert response.status_code == 400


# --------------------------------------------------------------------------
# Erros
# --------------------------------------------------------------------------


class TestNotFound:
    def test_get_unknown_returns_404(self, client: TestClient):
        response = client.get(f"/api/tasks/{uuid4()}")
        assert response.status_code == 404

    def test_complete_unknown_returns_404(self, client: TestClient):
        response = client.post(f"/api/tasks/{uuid4()}/complete")
        assert response.status_code == 404

    def test_delete_unknown_returns_404(self, client: TestClient):
        response = client.delete(f"/api/tasks/{uuid4()}")
        assert response.status_code == 404


class TestSoftDelete:
    def test_delete_returns_204_and_hides_task(self, client: TestClient):
        created = client.post("/api/tasks", json=_create_payload()).json()
        task_id = created["id"]

        response = client.delete(f"/api/tasks/{task_id}")
        assert response.status_code == 204

        response = client.get(f"/api/tasks/{task_id}")
        assert response.status_code == 404
