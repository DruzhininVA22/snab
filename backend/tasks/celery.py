"""
Конфигурация Celery для SNAB.

Celery используется для фоновых задач (импорт, пересчеты, уведомления).
Worker запускается командой `celery -A tasks worker -l info`.
"""

import os
from celery import Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'snab.settings')
app = Celery('snab')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()