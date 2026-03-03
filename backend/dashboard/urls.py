from django.urls import path

from .views import DashboardOpsView

urlpatterns = [
    path("ops/", DashboardOpsView.as_view(), name="dashboard-ops"),
]
