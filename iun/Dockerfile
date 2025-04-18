# image: https://docker.aityp.com/image/docker.io/python:3.12-slim?platform=linux/arm64
FROM python:3.12-slim

WORKDIR /home/pyuser/iun

RUN useradd -m pyuser && \
    chown pyuser:pyuser /home/pyuser/iun

COPY ./packages /usr/local/lib/python3.12/site-packages/
RUN pip install --upgrade pip requests


COPY --chown=pyuser:pyuser ./iun.py /home/pyuser/iun/
COPY --chown=pyuser:pyuser ./app /home/pyuser/iun/app/
RUN mkdir -p /home/pyuser/iun/config /home/pyuser/iun/logs && \
    chown -R pyuser:pyuser /home/pyuser/iun && \
    chmod -R 755 /home/pyuser/iun

USER pyuser

CMD ["python", "iun.py"]
