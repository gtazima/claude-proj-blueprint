from abc import ABC, abstractmethod


class AIProvider(ABC):
    @abstractmethod
    async def complete(self, prompt: str, **kwargs) -> str: ...

    @abstractmethod
    async def stream(self, prompt: str, **kwargs): ...
