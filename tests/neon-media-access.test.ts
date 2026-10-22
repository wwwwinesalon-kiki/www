import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { ARTICLE_MEDIA_ACCESS_SQL } from '../lib/neon/media-access';

const schema = new URL(
  '../migrations/neon/0001_www_schema.sql',
  import.meta.url,
);
const articleId = '11111111-1111-4111-8111-111111111111';
const mediaId = '22222222-2222-4222-8222-222222222222';
const objectPath = 'articles/private/legacy.webp';

describe('Neon private article image access', () => {
  it('requires byte verification and only exposes referenced published member images', async () => {
    const db = new PGlite();
    try {
      await db.exec(await readFile(schema, 'utf8'));
      await db.query(
        `insert into contents (id, type, title, slug, body, body_format)
         values ($1, 'FIELD', '畑の話', 'field-story', '', 'html')`,
        [articleId],
      );
      await db.query(
        `insert into article_media
          (id, article_id, object_path, alt, mime_type, size_bytes)
         values ($1, $2, $3, '畑', 'image/webp', 8)`,
        [mediaId, articleId, objectPath],
      );
      const read = async (editor: boolean, entitled: boolean) =>
        (await db.query(ARTICLE_MEDIA_ACCESS_SQL, [mediaId, editor, entitled]))
          .rows;

      expect(await read(true, false)).toHaveLength(0);
      expect(await read(false, true)).toHaveLength(0);

      await db.query(
        `insert into www_media_migration_status
          (media_id, target_object_key, sha256, verified_at)
         values ($1, $2, $3, now())`,
        [mediaId, objectPath, 'a'.repeat(64)],
      );
      expect(await read(true, false)).toHaveLength(1);
      expect(await read(false, true)).toHaveLength(0);

      await db.query(
        `update contents set publish_status='published',
         body='<img src="/api/media/${mediaId}" alt="畑">'
         where id=$1`,
        [articleId],
      );
      expect(await read(false, false)).toHaveLength(0);
      expect(await read(false, true)).toHaveLength(1);

      await db.query('update contents set archived_at=now() where id=$1', [
        articleId,
      ]);
      expect(await read(false, true)).toHaveLength(0);
      await db.query(
        'update contents set archived_at=null, member_visible=false where id=$1',
        [articleId],
      );
      expect(await read(false, true)).toHaveLength(0);
    } finally {
      await db.close();
    }
  }, 30000);
});
