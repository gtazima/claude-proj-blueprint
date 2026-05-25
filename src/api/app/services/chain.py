"""
Serviço de cadeias de tarefas.

Uma cadeia é uma sequência ordenada de tarefas relacionadas. As regras:
- Vínculo é sempre bidirecional e transitivo (A-B + B-C = cadeia A-B-C)
- Uma tarefa pode pertencer a múltiplas cadeias independentes
- O título é atualizado automaticamente: "base | pos/total" por cadeia
- Ao remover/excluir um membro, os demais são reposicionados e os títulos atualizados
"""

from uuid import UUID

from sqlmodel import Session, select

from app.models.chain import TaskChain, TaskChainMember
from app.models.task import Task


CHAIN_SEP = " | "
SUFFIX_SEP = "/"


class ChainService:
    def __init__(self, session: Session):
        self.session = session

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------

    def get_memberships(self, task_id: UUID) -> list[TaskChainMember]:
        stmt = select(TaskChainMember).where(TaskChainMember.task_id == task_id)
        return list(self.session.exec(stmt).all())

    def get_chain_members(self, chain_id: UUID) -> list[TaskChainMember]:
        stmt = (
            select(TaskChainMember)
            .where(TaskChainMember.chain_id == chain_id)
            .order_by(TaskChainMember.position)
        )
        return list(self.session.exec(stmt).all())

    def get_chains_for_task(self, task_id: UUID) -> list[tuple[TaskChain, list[TaskChainMember]]]:
        """Retorna todas as cadeias a que a tarefa pertence, com seus membros ordenados."""
        memberships = self.get_memberships(task_id)
        result = []
        for m in memberships:
            chain = self.session.get(TaskChain, m.chain_id)
            if chain:
                members = self.get_chain_members(chain.id)
                result.append((chain, members))
        return result

    def chain_infos_for_task(self, task_id: UUID) -> list[dict]:
        """Retorna dados de posição para serialização no schema ChainInfo."""
        infos = []
        for chain, members in self.get_chains_for_task(task_id):
            pos = next((m.position for m in members if m.task_id == task_id), None)
            if pos is not None:
                infos.append({
                    "chain_id": chain.id,
                    "position": pos,
                    "total": len(members),
                    "task_ids": [m.task_id for m in members],
                })
        return infos

    def get_chain_tails(self) -> list[Task]:
        """
        Retorna a última tarefa de cada cadeia (usada no picker do modal).
        Se uma tarefa é cauda de múltiplas cadeias, aparece uma vez por cadeia.
        Deduplicado pelo task_id.
        """
        stmt = select(TaskChain)
        chains = list(self.session.exec(stmt).all())
        seen: set[UUID] = set()
        tails: list[Task] = []
        for chain in chains:
            members = self.get_chain_members(chain.id)
            if not members:
                continue
            last_member = members[-1]
            if last_member.task_id in seen:
                continue
            task = self.session.get(Task, last_member.task_id)
            if task and task.deleted_at is None:
                seen.add(task.id)
                tails.append(task)
        return tails

    # ------------------------------------------------------------------
    # Vinculação
    # ------------------------------------------------------------------

    def link(self, task_a_id: UUID, task_b_id: UUID) -> None:
        """
        Cria vínculo entre task_a e task_b na mesma cadeia.

        Algoritmo:
        1. Se já estão na mesma cadeia: no-op
        2. Se task_b é a última de alguma cadeia e task_a não está nela: adiciona task_a após task_b
        3. Se task_a é a última de alguma cadeia e task_b não está nela: adiciona task_b após task_a
        4. Se ambas têm cadeias distintas sem ponto em comum: nova cadeia com ambas
        5. Se nenhuma tem cadeia: cria nova cadeia [task_b(1), task_a(2)] (task_b mencionada primeiro)
        """
        if task_a_id == task_b_id:
            return

        # Verifica se já compartilham uma cadeia
        chains_a = {m.chain_id for m in self.get_memberships(task_a_id)}
        chains_b = {m.chain_id for m in self.get_memberships(task_b_id)}
        if chains_a & chains_b:
            return  # já estão juntas em ao menos uma cadeia

        # task_b como cauda → adicionar task_a após ela
        for chain_id in chains_b:
            members = self.get_chain_members(chain_id)
            if members and members[-1].task_id == task_b_id and task_a_id not in {m.task_id for m in members}:
                self._append_member(chain_id, task_a_id, members[-1].position + 1)
                self._update_chain_titles(chain_id)
                return

        # task_a como cauda → adicionar task_b após ela
        for chain_id in chains_a:
            members = self.get_chain_members(chain_id)
            if members and members[-1].task_id == task_a_id and task_b_id not in {m.task_id for m in members}:
                self._append_member(chain_id, task_b_id, members[-1].position + 1)
                self._update_chain_titles(chain_id)
                return

        # Nenhuma cadeia existente é adequada — cria nova
        chain = TaskChain()
        self.session.add(chain)
        self.session.commit()
        self.session.refresh(chain)
        self._append_member(chain.id, task_b_id, 1)
        self._append_member(chain.id, task_a_id, 2)
        self._update_chain_titles(chain.id)

    def unlink(self, task_a_id: UUID, task_b_id: UUID) -> None:
        """Remove o vínculo direto entre task_a e task_b na cadeia compartilhada."""
        chains_a = {m.chain_id for m in self.get_memberships(task_a_id)}
        chains_b = {m.chain_id for m in self.get_memberships(task_b_id)}
        shared = chains_a & chains_b

        for chain_id in shared:
            self._remove_member_from_chain(task_a_id, chain_id)
            self._update_chain_titles(chain_id)

    def remove_task_from_all_chains(self, task_id: UUID) -> None:
        """Chamado ao excluir uma tarefa — remove de todas as cadeias e renumera."""
        for m in self.get_memberships(task_id):
            chain_id = m.chain_id
            self._remove_member_from_chain(task_id, chain_id)
            self._update_chain_titles(chain_id)

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------

    def _append_member(self, chain_id: UUID, task_id: UUID, position: int) -> None:
        member = TaskChainMember(chain_id=chain_id, task_id=task_id, position=position)
        self.session.add(member)
        self.session.commit()

    def _remove_member_from_chain(self, task_id: UUID, chain_id: UUID) -> None:
        stmt = select(TaskChainMember).where(
            TaskChainMember.chain_id == chain_id,
            TaskChainMember.task_id == task_id,
        )
        member = self.session.exec(stmt).first()
        if member:
            self.session.delete(member)
            self.session.commit()
        # Renumera posições restantes consecutivamente
        remaining = self.get_chain_members(chain_id)
        for i, m in enumerate(remaining, start=1):
            m.position = i
            self.session.add(m)
        self.session.commit()
        # Se sobrou apenas 1 membro, dissolve a cadeia
        if len(remaining) <= 1:
            for m in remaining:
                task = self.session.get(Task, m.task_id)
                if task:
                    self._restore_base_title(task)
            for m in remaining:
                self.session.delete(m)
            self.session.commit()
            chain = self.session.get(TaskChain, chain_id)
            if chain:
                self.session.delete(chain)
            self.session.commit()

    def _update_chain_titles(self, chain_id: UUID) -> None:
        """Atualiza o campo `title` de todos os membros da cadeia com o sufixo correto."""
        members = self.get_chain_members(chain_id)
        total = len(members)
        for m in members:
            task = self.session.get(Task, m.task_id)
            if not task:
                continue
            # Garante base_title preenchido
            if not task.base_title:
                task.base_title = self._strip_chain_suffixes(task.title)
            task.title = self._build_title(task, task.id)
            self.session.add(task)
        self.session.commit()

    def _build_title(self, task: Task, task_id: UUID) -> str:
        """Compõe título com sufixos de todas as cadeias da tarefa."""
        base = task.base_title or self._strip_chain_suffixes(task.title)
        suffixes = []
        for chain, members in self.get_chains_for_task(task_id):
            total = len(members)
            pos = next((m.position for m in members if m.task_id == task_id), None)
            if pos is not None:
                suffixes.append(f"{pos}{SUFFIX_SEP}{total}")
        if suffixes:
            return base + CHAIN_SEP + CHAIN_SEP.join(suffixes)
        return base

    def _strip_chain_suffixes(self, title: str) -> str:
        """Remove sufixos no formato ' | N/M' do título."""
        import re
        return re.sub(r"(\s\|\s\d+/\d+)+$", "", title).strip()

    def _restore_base_title(self, task: Task) -> None:
        """Restaura title a partir de base_title ao sair de todas as cadeias."""
        if task.base_title:
            task.title = task.base_title
            task.base_title = None
            self.session.add(task)
            self.session.commit()
