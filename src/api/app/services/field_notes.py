from datetime import date, datetime, timezone
from uuid import UUID

from sqlmodel import Session, select

from app.models.fieldnote import FieldNote
from app.models.task import Task
from app.schemas.fieldnote import FieldNoteCreate


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FieldNoteService:
    def __init__(self, session: Session):
        self.session = session

    def create(self, payload: FieldNoteCreate) -> FieldNote:
        note = FieldNote(
            content=payload.content,
            entry_type="manual",
            culture=payload.culture,
            management_unit=payload.management_unit,
            executor=payload.executor,
        )
        self.session.add(note)
        self.session.commit()
        self.session.refresh(note)
        return note

    def create_from_task(self, task: Task, observation: str | None = None) -> FieldNote:
        if observation:
            content = observation.strip()
            content += f"\n— {task.title}"
            if task.deferral_count > 0 and task.last_deferral_reason:
                content += f"\nAdiada {task.deferral_count}× — {task.last_deferral_reason}"
        else:
            content = f"Tarefa concluída: {task.title}"
            if task.deferral_count > 0 and task.last_deferral_reason:
                content += f"\nAdiada {task.deferral_count}× — último motivo: {task.last_deferral_reason}"
        note = FieldNote(
            content=content,
            entry_type="task_completed",
            source_task_id=task.id,
            executor=task.executor,
        )
        self.session.add(note)
        self.session.commit()
        self.session.refresh(note)
        return note

    def list(
        self,
        *,
        culture: str | None = None,
        executor: str | None = None,
        entry_type: str | None = None,
        keyword: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[FieldNote]:
        stmt = select(FieldNote).order_by(FieldNote.created_at.desc())
        if culture:
            stmt = stmt.where(FieldNote.culture == culture)
        if executor:
            stmt = stmt.where(FieldNote.executor == executor)
        if entry_type:
            stmt = stmt.where(FieldNote.entry_type == entry_type)
        if keyword:
            stmt = stmt.where(FieldNote.content.ilike(f"%{keyword}%"))
        if date_from:
            start = datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc)
            stmt = stmt.where(FieldNote.created_at >= start)
        if date_to:
            end = datetime(date_to.year, date_to.month, date_to.day, 23, 59, 59, tzinfo=timezone.utc)
            stmt = stmt.where(FieldNote.created_at <= end)
        return list(self.session.exec(stmt.offset(offset).limit(limit)).all())
