from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Session, select

from app.models.purchase import PurchaseItem, PurchaseItemLink
from app.schemas.purchase import AddLinkPayload, PurchaseItemCreate, PurchaseItemUpdate


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PurchaseItemNotFoundError(Exception):
    pass


class PurchaseService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ─── helpers ──────────────────────────────────────────────────────────────

    def _get(self, item_id: UUID) -> PurchaseItem:
        item = self.session.get(PurchaseItem, item_id)
        if item is None:
            raise PurchaseItemNotFoundError(f"PurchaseItem {item_id} not found")
        return item

    def _links(self, item_id: UUID) -> list[PurchaseItemLink]:
        return list(
            self.session.exec(
                select(PurchaseItemLink)
                .where(PurchaseItemLink.purchase_item_id == item_id)
                .order_by(PurchaseItemLink.created_at)
            ).all()
        )

    # ─── CRUD ─────────────────────────────────────────────────────────────────

    def create(self, payload: PurchaseItemCreate) -> tuple[PurchaseItem, list[PurchaseItemLink]]:
        item = PurchaseItem(name=payload.name, notes=payload.notes)
        self.session.add(item)
        self.session.flush()
        links = []
        for url in payload.links:
            link = PurchaseItemLink(purchase_item_id=item.id, url=url)
            self.session.add(link)
            links.append(link)
        self.session.commit()
        self.session.refresh(item)
        return item, links

    def get(self, item_id: UUID) -> tuple[PurchaseItem, list[PurchaseItemLink]]:
        item = self._get(item_id)
        return item, self._links(item_id)

    def update(self, item_id: UUID, payload: PurchaseItemUpdate) -> PurchaseItem:
        item = self._get(item_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return item

    def delete(self, item_id: UUID) -> None:
        item = self._get(item_id)
        # cascade: remove links first
        for link in self._links(item_id):
            self.session.delete(link)
        self.session.delete(item)
        self.session.commit()

    def list(
        self,
        *,
        status: str | None = None,
        keyword: str | None = None,
    ) -> list[tuple[PurchaseItem, list[PurchaseItemLink]]]:
        stmt = select(PurchaseItem).order_by(PurchaseItem.created_at.desc())
        if status:
            stmt = stmt.where(PurchaseItem.status == status)
        if keyword:
            stmt = stmt.where(PurchaseItem.name.ilike(f"%{keyword}%"))  # type: ignore[attr-defined]
        items = list(self.session.exec(stmt).all())
        return [(item, self._links(item.id)) for item in items]

    # ─── Status transitions ───────────────────────────────────────────────────

    def mark_bought(self, item_id: UUID) -> PurchaseItem:
        item = self._get(item_id)
        item.status = "bought"
        item.bought_at = _utcnow()
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return item

    def mark_to_buy(self, item_id: UUID) -> PurchaseItem:
        item = self._get(item_id)
        item.status = "to_buy"
        item.bought_at = None
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return item

    # ─── Links ────────────────────────────────────────────────────────────────

    def add_link(self, item_id: UUID, payload: AddLinkPayload) -> PurchaseItemLink:
        self._get(item_id)
        link = PurchaseItemLink(purchase_item_id=item_id, url=payload.url)
        self.session.add(link)
        self.session.commit()
        self.session.refresh(link)
        return link

    def remove_link(self, link_id: UUID) -> None:
        link = self.session.get(PurchaseItemLink, link_id)
        if link is None:
            raise PurchaseItemNotFoundError(f"Link {link_id} not found")
        self.session.delete(link)
        self.session.commit()
