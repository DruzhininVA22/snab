from django.test import TestCase
from catalog.models import Category


class CategoryLeafLogicTests(TestCase):
    def test_leaf_flags_on_create_move_delete(self):
        root = Category.objects.create(code="H01", name="Root")
        root.refresh_from_db()
        self.assertTrue(root.is_leaf)

        child = Category.objects.create(code="H01-01", name="Child", parent=root)
        root.refresh_from_db()
        child.refresh_from_db()
        self.assertFalse(root.is_leaf)
        self.assertTrue(child.is_leaf)
        self.assertEqual(child.level, 1)
        self.assertEqual(child.path, f"{root.path}{child.code}/")

        grand = Category.objects.create(code="H01-01-01", name="Grand", parent=child)
        child.refresh_from_db()
        grand.refresh_from_db()
        self.assertFalse(child.is_leaf)
        self.assertTrue(grand.is_leaf)
        self.assertEqual(grand.level, 2)
        self.assertEqual(grand.path, f"{child.path}{grand.code}/")

        # Move grand under root
        grand.parent = root
        grand.save()
        root.refresh_from_db()
        child.refresh_from_db()
        grand.refresh_from_db()

        self.assertFalse(root.is_leaf)
        self.assertTrue(child.is_leaf)  # child has no children now
        self.assertEqual(grand.level, 1)
        self.assertEqual(grand.path, f"{root.path}{grand.code}/")

        # Delete moved node: root still has 'child' => not leaf yet
        grand.delete()
        root.refresh_from_db()
        self.assertFalse(root.is_leaf)

        # Delete last remaining child: root becomes leaf again
        child.delete()
        root.refresh_from_db()
        self.assertTrue(root.is_leaf)
