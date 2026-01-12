# backend/snab/settings.py
"""
Настройки Django проекта SNAB.

Конфигурация рассчитана на работу в Docker Compose и подключение SPA‑клиента.
Содержит параметры базы данных, CORS/CSRF и список приложений SNAB.
"""

import environ, os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR.parent, '.env.web'))

SECRET_KEY = env('DJANGO_SECRET_KEY', default='dev-secret')
DEBUG = bool(int(env('DJANGO_DEBUG', default=1)))
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['*'])

# --- CORS/CSRF для фронта и админки ---
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173", "http://127.0.0.1:5173",
]
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173", "http://127.0.0.1:5173",
    # для прямого доступа к админке со своего хоста:
    "http://localhost:8000", "http://127.0.0.1:8000",
]

INSTALLED_APPS = [
    # Jazzmin ДОЛЖЕН быть раньше django.contrib.admin
    "jazzmin",

    # стандартные
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # сторонние
    "rest_framework",
    "django_filters",   # нужно для DRF-фильтрации (мы её используем ниже)
    "corsheaders",

    # наши
    "core",
    "procurement",
    "warehouse",
    "projects.apps.ProjectsConfig",
    "tasks",
    "catalog",
    "suppliers",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # важно ДО CommonMiddleware
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "snab.urls"
ASGI_APPLICATION = "snab.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # путь к шаблонам
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": env.db("DATABASE_URL")
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [env("REDIS_URL")]},
    }
}

STATIC_URL = "static/"
STATIC_ROOT = "app/staticfiles/"

REST_FRAMEWORK = {
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        # при необходимости можно добавить Token/JWT
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

LANGUAGE_CODE = "ru"
TIME_ZONE = "Europe/Vienna"
USE_I18N = True
USE_TZ = True

DATE_FORMAT = "d.m.Y"
DATETIME_FORMAT = "d.m.Y H:i"

# --- Jazzmin ---
JAZZMIN_SETTINGS = {
    "site_title": "СНАБ — админка",
    "site_header": "СНАБ",
    "welcome_sign": "Добро пожаловать в СНАБ",
    "show_sidebar": True,

    # Кастомная плитка (если model/URL нет, сама админка не падает — просто ссылка 404)
    "custom_links": {
        "core": [
            {
                "name": "Импорт данных",
                "url": "admin:core_importhub_changelist",
                "icon": "fas fa-file-import",
            },
        ],
    },

    # Можно скрыть модель ImportHub из меню (если она зарегистрирована)
    "hide_models": [
        "core.ImportHub",
        "core.importhub",
    ],

    # Порядок/иконки — оставил твои
    "order_with_respect_to": [
        "core", "core.Unit", "core.Supplier", "core.Item",
        "procurement", "procurement.PriceRecord", "procurement.PurchaseRequest",
        "procurement.PurchaseOrder", "procurement.Quote", "procurement.RFQ",
        "warehouse",
    ],
    "icons": {
        "core.Unit": "fas fa-weight-hanging",
        "core.Supplier": "fas fa-truck",
        "core.Item": "fas fa-cubes",
        "procurement.PurchaseRequest": "fas fa-list",
        "procurement.PurchaseOrder": "fas fa-file-invoice",
        "procurement.Quote": "fas fa-file-signature",
        "procurement.RFQ": "fas fa-envelope-open-text",
        "warehouse.Warehouse": "fas fa-warehouse",
        "warehouse.Stock": "fas fa-boxes-stacked",
    },
}

JAZZMIN_UI_TWEAKS = {
    "theme": "solar",               # тёмная тема
    "dark_mode_theme": "darkly",
    "navbar": "navbar-dark",
    "sidebar": "sidebar-dark-primary",
    "footer_fixed": False,
    "body_small_text": False,
    "brand_color": "indigo",
    "accent": "indigo",
    "primary_color": "indigo",
    "button_classes": {
        "primary": "btn-primary",
        "secondary": "btn-outline-secondary",
        "info": "btn-outline-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success",
    },
}