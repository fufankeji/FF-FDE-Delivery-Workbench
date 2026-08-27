ARG PYTHON_BASE=python:3.12-slim
FROM ${PYTHON_BASE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN pip install --no-cache-dir \
    joblib==1.5.3 \
    numpy==2.5.1 \
    openpyxl==3.1.5 \
    pandas==3.0.5 \
    polars==1.43.2 \
    pyarrow==25.0.0 \
    scikit-learn==1.9.0

RUN useradd --create-home --uid 10001 runner
USER runner
WORKDIR /workspace

ENTRYPOINT ["python"]
