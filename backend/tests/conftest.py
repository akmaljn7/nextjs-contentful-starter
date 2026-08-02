import pytest_asyncio  # noqa: F401
import pytest

# pytest-asyncio: mark all async tests as asyncio automatically
def pytest_collection_modifyitems(config, items):
    for item in items:
        if "asyncio" not in item.keywords:
            import asyncio, inspect
            if inspect.iscoroutinefunction(getattr(item, "function", None)):
                item.add_marker(pytest.mark.asyncio)
