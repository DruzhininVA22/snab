"""
Тесты на compatibility-роуты projects, которые фронт использует как fallback.

Цель: чтобы UI не ловил 404 при обращении к старым/альтернативным URL.
"""

from rest_framework.test import APITestCase
from rest_framework import status

from projects.models import Project, ProjectStage


class ProjectsCompatRoutesTests(APITestCase):
    def setUp(self):
        self.project = Project.objects.create(code="P-001", name="Test Project")
        ProjectStage.objects.create(project=self.project, name="Stage 1", order=1, status="planned")

    def test_projects_lite_aliases(self):
        for url in ("/api/projects/", "/api/projects/project/", "/api/projects/list/"):
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_project_stages_aliases(self):
        urls = [
            f"/api/projects/project-stages/?project={self.project.id}",
            f"/api/projects/stages/?project={self.project.id}",
            f"/api/projects/projectstages/?project={self.project.id}",
            f"/api/projects/stage/?project={self.project.id}",
        ]
        for url in urls:
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
