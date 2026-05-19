from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.db.session import get_session
from app.schemas.purchase import (
    AddLinkPayload,
    PurchaseItemCreate,
    PurchaseItemLinkRead,
    PurchaseItemRead,
    PurchaseItemUpdate,
)
from app.services.purchase import PurchaseItemNotFoundError, PurchaseService
from sqlmodel import Session

router = APIRouter(prefix="/purchase-items", tags=["purchase"], dependencies=[Depends(get_current_user)])


def _svc(session: Session = Depends(get_session)) -> PurchaseService:
    return PurchaseService(session)


def _to_read(item, links) -> PurchaseItemRead:
    return PurchaseItemRead(
        id=item.id,
        name=item.name,
        notes=item.notes,
        status=item.status,
        created_at=item.created_at,
        bought_at=item.bought_at,
        links=[PurchaseItemLinkRead.model_validate(l) for l in links],
    )


@router.get("", response_model=list[PurchaseItemRead])
def list_items(
    status: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    svc: PurchaseService = Depends(_svc),
) -> list[PurchaseItemRead]:
    return [_to_read(item, links) for item, links in svc.list(status=status, keyword=keyword)]


@router.post("", response_model=PurchaseItemRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: PurchaseItemCreate, svc: PurchaseService = Depends(_svc)) -> PurchaseItemRead:
    item, links = svc.create(payload)
    return _to_read(item, links)


@router.get("/{item_id}", response_model=PurchaseItemRead)
def get_item(item_id: UUID, svc: PurchaseService = Depends(_svc)) -> PurchaseItemRead:
    try:
        item, links = svc.get(item_id)
    except PurchaseItemNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _to_read(item, links)


@router.patch("/{item_id}", response_model=PurchaseItemRead)
def update_item(item_id: UUID, payload: PurchaseItemUpdate, svc: PurchaseService = Depends(_svc)) -> PurchaseItemRead:
    try:
        item = svc.update(item_id, payload)
        _, links = svc.get(item_id)
    except PurchaseItemNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _to_read(item, links)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: UUID, svc: PurchaseService = Depends(_svc)) -> None:
    try:
        svc.delete(item_id)
    except PurchaseItemNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{item_id}/buy", response_model=PurchaseItemRead)
def mark_bought(item_id: UUID, svc: PurchaseService = Depends(_svc)) -> PurchaseItemRead:
    try:
        item = svc.mark_bought(item_id)
        _, links = svc.get(item_id)
    except PurchaseItemNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _to_read(item, links)


@router.post("/{item_id}/unbuy", response_model=PurchaseItemRead)
def mark_to_buy(item_id: UUID, svc: PurchaseService = Depends(_svc)) -> PurchaseItemRead:
    try:
        item = svc.mark_to_buy(item_id)
        _, links = svc.get(item_id)
    except PurchaseItemNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _to_read(item, links)


@router.post("/{item_id}/links", response_model=PurchaseItemLinkRead, status_code=status.HTTP_201_CREATED)
def add_link(item_id: UUID, payload: AddLinkPayload, svc: PurchaseService = Depends(_svc)) -> PurchaseItemLinkRead:
    try:
        link = svc.add_link(item_id, payload)
    except PurchaseItemNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return PurchaseItemLinkRead.model_validate(link)


@router.delete("/{item_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_link(item_id: UUID, link_id: UUID, svc: PurchaseService = Depends(_svc)) -> None:
    try:
        svc.remove_link(link_id)
    except PurchaseItemNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
