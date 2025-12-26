"""
CSRF‑служебные ручки для SPA.

Фронтенд (Vite/React) работает как отдельное SPA и выполняет запросы к API.
Для безопасных модифицирующих запросов Django ожидает CSRF cookie/заголовок — этот модуль помогает его получить.
"""

from django.views.decorators.csrf import ensure_csrf_cookie
from django.http import HttpResponse

@ensure_csrf_cookie
def csrf(request):
    """
    Сервисная ручка для получения CSRF-cookie/токена при работе SPA + Django.
    Нужна, чтобы клиент мог корректно отправлять state-changing запросы (POST/PUT/DELETE).
    """

    return HttpResponse(status=204)  # просто ставим cookie и ничего не отдаём