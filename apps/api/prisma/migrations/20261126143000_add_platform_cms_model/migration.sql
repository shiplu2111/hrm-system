-- CreateEnum
CREATE TYPE "cms_locale" AS ENUM ('en', 'bn');

-- CreateEnum
CREATE TYPE "cms_translation_status" AS ENUM ('untranslated', 'in_review', 'translated');

-- CreateEnum
CREATE TYPE "cms_page_kind" AS ENUM ('system', 'custom');

-- CreateEnum
CREATE TYPE "cms_page_status" AS ENUM ('draft', 'scheduled', 'published', 'unpublished', 'trashed');

-- CreateEnum
CREATE TYPE "cms_post_status" AS ENUM ('draft', 'scheduled', 'published', 'unpublished', 'trashed');

-- CreateEnum
CREATE TYPE "cms_changelog_tag" AS ENUM ('new', 'improved', 'fixed', 'security');

-- CreateEnum
CREATE TYPE "cms_career_status" AS ENUM ('draft', 'open', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "cms_menu_location" AS ENUM ('header', 'footer', 'mobile', 'legal', 'custom');

-- CreateEnum
CREATE TYPE "cms_redirect_type" AS ENUM ('permanent_308', 'permanent_301', 'temporary_302', 'temporary_307');

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" UUID NOT NULL,
    "kind" "cms_page_kind" NOT NULL DEFAULT 'custom',
    "slug" TEXT NOT NULL,
    "status" "cms_page_status" NOT NULL DEFAULT 'draft',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "current_published_version_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_locales" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "locale" "cms_locale" NOT NULL,
    "is_translated" BOOLEAN NOT NULL DEFAULT false,
    "translation_status" "cms_translation_status" NOT NULL DEFAULT 'untranslated',
    "current_draft_version_id" UUID,
    "current_published_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_page_locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_versions" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "locale" "cms_locale" NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "canonical_path" TEXT,
    "og_image_url" TEXT,
    "no_index" BOOLEAN NOT NULL DEFAULT false,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "is_translated" BOOLEAN NOT NULL DEFAULT false,
    "author_id" UUID,
    "author_name" TEXT,
    "change_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_media" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt_en" TEXT,
    "alt_bn" TEXT,
    "caption_en" TEXT,
    "caption_bn" TEXT,
    "folder" TEXT NOT NULL DEFAULT 'general',
    "uploaded_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_menus" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" "cms_menu_location" NOT NULL DEFAULT 'header',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_menu_items" (
    "id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "parent_id" UUID,
    "label_en" TEXT NOT NULL,
    "label_bn" TEXT,
    "description_en" TEXT,
    "description_bn" TEXT,
    "target_page_id" UUID,
    "href" TEXT NOT NULL,
    "badge_en" TEXT,
    "badge_bn" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "open_in_new_tab" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_redirects" (
    "id" UUID NOT NULL,
    "source_path" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "redirect_type" "cms_redirect_type" NOT NULL DEFAULT 'permanent_308',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_post_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_bn" TEXT,
    "description_en" TEXT,
    "description_bn" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_post_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_authors" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "display_name_bn" TEXT,
    "role_title" TEXT,
    "role_title_bn" TEXT,
    "bio_en" TEXT,
    "bio_bn" TEXT,
    "avatar_media_id" UUID,
    "platform_user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_posts" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "cms_post_status" NOT NULL DEFAULT 'draft',
    "category_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "cover_media_id" UUID,
    "title_en" TEXT NOT NULL,
    "title_bn" TEXT,
    "excerpt_en" TEXT NOT NULL,
    "excerpt_bn" TEXT,
    "body_json_en" JSONB NOT NULL DEFAULT '{}',
    "body_html_en" TEXT NOT NULL DEFAULT '',
    "body_json_bn" JSONB,
    "body_html_bn" TEXT,
    "is_bn_translated" BOOLEAN NOT NULL DEFAULT false,
    "bn_translation_status" "cms_translation_status" NOT NULL DEFAULT 'untranslated',
    "seo_title_en" TEXT,
    "seo_description_en" TEXT,
    "seo_title_bn" TEXT,
    "seo_description_bn" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reading_time_minutes" INTEGER NOT NULL DEFAULT 3,
    "scheduled_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_changelog_entries" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "version_label" TEXT NOT NULL,
    "release_date" DATE NOT NULL,
    "tag" "cms_changelog_tag" NOT NULL DEFAULT 'improved',
    "module_refs" TEXT,
    "title_en" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "highlights_en" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "title_bn" TEXT,
    "summary_bn" TEXT,
    "highlights_bn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_bn_translated" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "author_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_changelog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_careers" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "cms_career_status" NOT NULL DEFAULT 'draft',
    "department" TEXT NOT NULL,
    "location_type" TEXT NOT NULL,
    "location_text" TEXT NOT NULL,
    "employment_type" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "description_html_en" TEXT NOT NULL,
    "title_bn" TEXT,
    "summary_bn" TEXT,
    "description_html_bn" TEXT,
    "is_bn_translated" BOOLEAN NOT NULL DEFAULT false,
    "apply_email" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "closes_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_careers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_faqs" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "page_slug" TEXT,
    "question_en" TEXT NOT NULL,
    "answer_en" TEXT NOT NULL,
    "question_bn" TEXT,
    "answer_bn" TEXT,
    "is_bn_translated" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_site_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "updated_by_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "cms_pages_kind_idx" ON "cms_pages"("kind");

-- CreateIndex
CREATE INDEX "cms_pages_status_idx" ON "cms_pages"("status");

-- CreateIndex
CREATE INDEX "cms_pages_deleted_at_idx" ON "cms_pages"("deleted_at");

-- CreateIndex
CREATE INDEX "cms_pages_current_published_version_id_idx" ON "cms_pages"("current_published_version_id");

-- CreateIndex
CREATE INDEX "cms_page_locales_locale_is_translated_idx" ON "cms_page_locales"("locale", "is_translated");

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_locales_page_id_locale_key" ON "cms_page_locales"("page_id", "locale");

-- CreateIndex
CREATE INDEX "cms_page_versions_page_id_locale_idx" ON "cms_page_versions"("page_id", "locale");

-- CreateIndex
CREATE INDEX "cms_page_versions_author_id_idx" ON "cms_page_versions"("author_id");

-- CreateIndex
CREATE INDEX "cms_page_versions_created_at_idx" ON "cms_page_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_versions_page_id_locale_version_number_key" ON "cms_page_versions"("page_id", "locale", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "cms_media_storage_key_key" ON "cms_media"("storage_key");

-- CreateIndex
CREATE INDEX "cms_media_folder_idx" ON "cms_media"("folder");

-- CreateIndex
CREATE INDEX "cms_media_mime_type_idx" ON "cms_media"("mime_type");

-- CreateIndex
CREATE INDEX "cms_media_uploaded_by_id_idx" ON "cms_media"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "cms_media_deleted_at_idx" ON "cms_media"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_menus_slug_key" ON "cms_menus"("slug");

-- CreateIndex
CREATE INDEX "cms_menus_location_is_active_idx" ON "cms_menus"("location", "is_active");

-- CreateIndex
CREATE INDEX "cms_menu_items_menu_id_sort_order_idx" ON "cms_menu_items"("menu_id", "sort_order");

-- CreateIndex
CREATE INDEX "cms_menu_items_parent_id_idx" ON "cms_menu_items"("parent_id");

-- CreateIndex
CREATE INDEX "cms_menu_items_target_page_id_idx" ON "cms_menu_items"("target_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_redirects_source_path_key" ON "cms_redirects"("source_path");

-- CreateIndex
CREATE INDEX "cms_redirects_is_active_idx" ON "cms_redirects"("is_active");

-- CreateIndex
CREATE INDEX "cms_redirects_created_by_id_idx" ON "cms_redirects"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_post_categories_slug_key" ON "cms_post_categories"("slug");

-- CreateIndex
CREATE INDEX "cms_post_categories_sort_order_idx" ON "cms_post_categories"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "cms_authors_slug_key" ON "cms_authors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_authors_platform_user_id_key" ON "cms_authors"("platform_user_id");

-- CreateIndex
CREATE INDEX "cms_authors_is_active_idx" ON "cms_authors"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cms_posts_slug_key" ON "cms_posts"("slug");

-- CreateIndex
CREATE INDEX "cms_posts_status_published_at_idx" ON "cms_posts"("status", "published_at");

-- CreateIndex
CREATE INDEX "cms_posts_category_id_idx" ON "cms_posts"("category_id");

-- CreateIndex
CREATE INDEX "cms_posts_author_id_idx" ON "cms_posts"("author_id");

-- CreateIndex
CREATE INDEX "cms_posts_deleted_at_idx" ON "cms_posts"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_changelog_entries_slug_key" ON "cms_changelog_entries"("slug");

-- CreateIndex
CREATE INDEX "cms_changelog_entries_is_published_release_date_idx" ON "cms_changelog_entries"("is_published", "release_date");

-- CreateIndex
CREATE INDEX "cms_changelog_entries_tag_idx" ON "cms_changelog_entries"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "cms_careers_slug_key" ON "cms_careers"("slug");

-- CreateIndex
CREATE INDEX "cms_careers_status_department_idx" ON "cms_careers"("status", "department");

-- CreateIndex
CREATE INDEX "cms_careers_deleted_at_idx" ON "cms_careers"("deleted_at");

-- CreateIndex
CREATE INDEX "cms_faqs_category_is_published_sort_order_idx" ON "cms_faqs"("category", "is_published", "sort_order");

-- CreateIndex
CREATE INDEX "cms_faqs_page_slug_is_published_sort_order_idx" ON "cms_faqs"("page_slug", "is_published", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "cms_site_settings_key_key" ON "cms_site_settings"("key");

-- CreateIndex
CREATE INDEX "cms_site_settings_is_public_idx" ON "cms_site_settings"("is_public");

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_current_published_version_id_fkey" FOREIGN KEY ("current_published_version_id") REFERENCES "cms_page_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_locales" ADD CONSTRAINT "cms_page_locales_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_locales" ADD CONSTRAINT "cms_page_locales_current_draft_version_id_fkey" FOREIGN KEY ("current_draft_version_id") REFERENCES "cms_page_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_locales" ADD CONSTRAINT "cms_page_locales_current_published_version_id_fkey" FOREIGN KEY ("current_published_version_id") REFERENCES "cms_page_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_versions" ADD CONSTRAINT "cms_page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_versions" ADD CONSTRAINT "cms_page_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_media" ADD CONSTRAINT "cms_media_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_menu_items" ADD CONSTRAINT "cms_menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "cms_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_menu_items" ADD CONSTRAINT "cms_menu_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "cms_menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_menu_items" ADD CONSTRAINT "cms_menu_items_target_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "cms_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_redirects" ADD CONSTRAINT "cms_redirects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_authors" ADD CONSTRAINT "cms_authors_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "cms_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_authors" ADD CONSTRAINT "cms_authors_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_posts" ADD CONSTRAINT "cms_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cms_post_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_posts" ADD CONSTRAINT "cms_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "cms_authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_posts" ADD CONSTRAINT "cms_posts_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "cms_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_changelog_entries" ADD CONSTRAINT "cms_changelog_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_site_settings" ADD CONSTRAINT "cms_site_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Enforce URL-safe lowercase slugs & reserved route protection at database level
ALTER TABLE "cms_pages"
  ADD CONSTRAINT "cms_pages_slug_valid_chk"
  CHECK (
    "slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    AND "slug" NOT IN ('admin', 'api', 'app', 'platform', 'login', 'signup', 'public', '_next')
  );

ALTER TABLE "cms_posts"
  ADD CONSTRAINT "cms_posts_slug_valid_chk"
  CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

ALTER TABLE "cms_post_categories"
  ADD CONSTRAINT "cms_post_categories_slug_valid_chk"
  CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

ALTER TABLE "cms_authors"
  ADD CONSTRAINT "cms_authors_slug_valid_chk"
  CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

ALTER TABLE "cms_changelog_entries"
  ADD CONSTRAINT "cms_changelog_entries_slug_valid_chk"
  CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

ALTER TABLE "cms_careers"
  ADD CONSTRAINT "cms_careers_slug_valid_chk"
  CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

ALTER TABLE "cms_menus"
  ADD CONSTRAINT "cms_menus_slug_valid_chk"
  CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- System pages cannot be deleted, renamed, soft-deleted, or unpublished
CREATE OR REPLACE FUNCTION guard_cms_system_page()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."kind" = 'system' OR OLD."locked" = TRUE THEN
      RAISE EXCEPTION '[CMS_SYSTEM_LOCK] System page "%" cannot be deleted', OLD."slug";
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."kind" = 'system' OR OLD."locked" = TRUE THEN
      IF NEW."slug" IS DISTINCT FROM OLD."slug" THEN
        RAISE EXCEPTION '[CMS_SYSTEM_LOCK] System page "%" cannot be renamed', OLD."slug";
      END IF;
      IF NEW."kind" IS DISTINCT FROM 'system' OR NEW."locked" IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION '[CMS_SYSTEM_LOCK] System page "%" cannot be unlocked', OLD."slug";
      END IF;
      IF NEW."deleted_at" IS NOT NULL THEN
        RAISE EXCEPTION '[CMS_SYSTEM_LOCK] System page "%" cannot be soft-deleted', OLD."slug";
      END IF;
      IF NEW."status" IN ('unpublished', 'trashed') THEN
        RAISE EXCEPTION '[CMS_SYSTEM_LOCK] System page "%" cannot be unpublished or trashed', OLD."slug";
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_cms_system_page
BEFORE UPDATE OR DELETE ON "cms_pages"
FOR EACH ROW EXECUTE FUNCTION guard_cms_system_page();

-- Page version snapshots are strictly immutable once saved
CREATE OR REPLACE FUNCTION guard_cms_page_version_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '[IMMUTABLE] cms_page_versions rows are immutable once saved (id=%)', OLD."id";
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_cms_page_version_immutable
BEFORE UPDATE OR DELETE ON "cms_page_versions"
FOR EACH ROW EXECUTE FUNCTION guard_cms_page_version_immutable();
