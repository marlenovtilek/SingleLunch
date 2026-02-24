from pathlib import Path
from os import environ

from django.core.exceptions import ImproperlyConfigured
from django.core.management.utils import get_random_secret_key


def env_bool(name: str, default: bool = False) -> bool:
    value = environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: list[str] | None = None) -> list[str]:
    value = environ.get(name)
    if not value:
        return default or []
    return [item.strip() for item in value.split(",") if item.strip()]


def env_int(name: str, default: int) -> int:
    value = environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

######################################################################
# General
######################################################################
BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = env_bool("DEBUG", False)

SECRET_KEY = environ.get("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = get_random_secret_key()
    else:
        raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG=False.")

ALLOWED_HOSTS = env_list(
    "ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1", "api"],
)

CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:3000", "http://localhost:8765"],
)

WSGI_APPLICATION = "api.wsgi.application"

ROOT_URLCONF = "api.urls"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
######################################################################
# Apps
######################################################################
INSTALLED_APPS = [
    "unfold",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "app_users",
    "app_orders",
    "app_finance",
    "app_catering",
]

######################################################################
# Middleware
######################################################################
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

######################################################################
# Templates
######################################################################
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
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

######################################################################
# Database
######################################################################
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "USER": environ.get("POSTGRES_USER", "postgres"),
        "PASSWORD": environ.get("POSTGRES_PASSWORD", ""),
        "NAME": environ.get("POSTGRES_DB", "db"),
        "HOST": environ.get("POSTGRES_HOST", "db"),
        "PORT": environ.get("POSTGRES_PORT", "5432"),
        "TEST": {
            "NAME": environ.get("POSTGRES_TEST_DB", "test"),
        },
    }
}

if not DEBUG and not DATABASES["default"]["PASSWORD"]:
    raise ImproperlyConfigured("POSTGRES_PASSWORD must be set when DEBUG=False.")

######################################################################
# Authentication
######################################################################
AUTH_USER_MODEL = "app_users.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

######################################################################
# Internationalization
######################################################################
LANGUAGE_CODE = "en-us"

TIME_ZONE = "Asia/Bishkek"

USE_I18N = True

USE_TZ = True

######################################################################
# Staticfiles
######################################################################
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", not DEBUG)
SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000 if not DEBUG else 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool(
    "SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG
)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = env_bool("SECURE_CONTENT_TYPE_NOSNIFF", True)
SECURE_REFERRER_POLICY = environ.get("SECURE_REFERRER_POLICY", "same-origin")
X_FRAME_OPTIONS = environ.get("X_FRAME_OPTIONS", "DENY")

######################################################################
# Rest Framework
######################################################################
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
}

MENU_NEXT_DAY_SWITCH_HOUR = env_int("MENU_NEXT_DAY_SWITCH_HOUR", 15)
MENU_NEXT_DAY_SWITCH_MINUTE = env_int("MENU_NEXT_DAY_SWITCH_MINUTE", 0)

######################################################################
# Unfold
######################################################################
from .theme_settings import UNFOLD
UNFOLD = UNFOLD
