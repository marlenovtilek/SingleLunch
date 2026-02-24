from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from api.auth_views import SingleLunchTokenObtainPairView
from api.health import healthz
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("healthz/", healthz, name="healthz"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
    ),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/token/", SingleLunchTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("app_users.urls")),
    path("api/", include("app_orders.urls")),
    path("api/", include("app_catering.urls")),
    path("admin/", admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
