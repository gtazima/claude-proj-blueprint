from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class TaskChain(SQLModel, table=True):
    __tablename__ = "task_chain"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskChainMember(SQLModel, table=True):
    __tablename__ = "task_chain_member"

    chain_id: UUID = Field(foreign_key="task_chain.id", primary_key=True)
    task_id: UUID = Field(foreign_key="task.id", primary_key=True)
    position: int
