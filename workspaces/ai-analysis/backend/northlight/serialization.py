from __future__ import annotations

import json
from typing import cast

import pandas as pd


def frame_records(frame: pd.DataFrame, limit: int | None = None) -> list[dict[str, object]]:
    selected = frame.head(limit) if limit is not None else frame
    return cast(
        list[dict[str, object]],
        json.loads(selected.to_json(orient="records", date_format="iso")),
    )
