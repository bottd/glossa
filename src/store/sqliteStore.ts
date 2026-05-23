import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface DefinitionInput {
  term: string; // normalized key
  display: string; // term as the author typed it
  definition: string;
  authorId: string;
  authorTag: string;
}

export interface Definition extends DefinitionInput {
  id: number;
  createdAt: number;
}

export interface TagRef {
  tag: string; // normalized
  display: string;
}

export interface ReferenceInput {
  messageLink: string | null;
  sourceAuthorTag: string | null;
  addedBy: string;
  tags: TagRef[];
}

export interface Reference extends Omit<ReferenceInput, 'tags'> {
  id: number;
  createdAt: number;
  tags: TagRef[];
}

export interface ImageInput {
  term: string | null;
  referenceId: number | null;
  url: string; // Discord attachment URL (not re-hosted)
  addedBy: string;
}

export interface ImageRef extends ImageInput {
  id: number;
  createdAt: number;
}

export class SqliteStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT NOT NULL,
        display TEXT NOT NULL,
        definition TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_tag TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_definitions_term ON definitions(term);

      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_link TEXT,
        source_author_tag TEXT,
        added_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookmark_tags (
        bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        display TEXT NOT NULL,
        PRIMARY KEY (bookmark_id, tag)
      );
      CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag);

      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT,
        reference_id INTEGER REFERENCES bookmarks(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        added_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_images_term ON images(term);
    `);
  }

  async addDefinition(input: DefinitionInput): Promise<Definition> {
    const createdAt = Date.now();
    const info = this.db
      .prepare(
        `INSERT INTO definitions (term, display, definition, author_id, author_tag, created_at)
         VALUES (@term, @display, @definition, @authorId, @authorTag, @createdAt)`,
      )
      .run({ ...input, createdAt });
    return {
      ...input,
      id: Number(info.lastInsertRowid),
      createdAt,
    };
  }

  async getDefinitions(term: string): Promise<Definition[]> {
    return this.db
      .prepare(
        `SELECT id, term, display, definition,
                author_id AS authorId, author_tag AS authorTag, created_at AS createdAt
         FROM definitions WHERE term = ? ORDER BY created_at ASC`,
      )
      .all(term) as Definition[];
  }

  async addReference(input: ReferenceInput): Promise<Reference> {
    const createdAt = Date.now();
    const insertRef = this.db.prepare(
      `INSERT INTO bookmarks (message_link, source_author_tag, added_by, created_at)
       VALUES (@messageLink, @sourceAuthorTag, @addedBy, @createdAt)`,
    );
    const insertTag = this.db.prepare(
      `INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag, display) VALUES (?, ?, ?)`,
    );

    const id = this.db.transaction(() => {
      const info = insertRef.run({ ...input, createdAt });
      const bookmarkId = Number(info.lastInsertRowid);
      for (const t of input.tags) insertTag.run(bookmarkId, t.tag, t.display);
      return bookmarkId;
    })();

    return { ...input, id, createdAt };
  }

  async getReferencesByTag(tag: string): Promise<Reference[]> {
    const rows = this.db
      .prepare(
        `SELECT b.id,
                b.message_link AS messageLink,
                b.source_author_tag AS sourceAuthorTag,
                b.added_by AS addedBy, b.created_at AS createdAt
         FROM bookmarks b
         JOIN bookmark_tags bt ON bt.bookmark_id = b.id
         WHERE bt.tag = ? ORDER BY b.created_at DESC`,
      )
      .all(tag) as Omit<Reference, 'tags'>[];

    if (rows.length === 0) return [];

    // Fetch every matched reference's tags in one query, then group in memory.
    const placeholders = rows.map(() => '?').join(', ');
    const tagRows = this.db
      .prepare(
        `SELECT bookmark_id AS bookmarkId, tag, display
         FROM bookmark_tags WHERE bookmark_id IN (${placeholders})`,
      )
      .all(...rows.map((row) => row.id)) as (TagRef & { bookmarkId: number })[];

    const tagsByRef = new Map<number, TagRef[]>();
    for (const { bookmarkId, tag, display } of tagRows) {
      const list = tagsByRef.get(bookmarkId) ?? [];
      list.push({ tag, display });
      tagsByRef.set(bookmarkId, list);
    }

    return rows.map((row) => ({ ...row, tags: tagsByRef.get(row.id) ?? [] }));
  }

  async addImage(input: ImageInput): Promise<ImageRef> {
    const createdAt = Date.now();
    const info = this.db
      .prepare(
        `INSERT INTO images (term, reference_id, url, added_by, created_at)
         VALUES (@term, @referenceId, @url, @addedBy, @createdAt)`,
      )
      .run({ ...input, createdAt });
    return { ...input, id: Number(info.lastInsertRowid), createdAt };
  }

  async getImagesForTerm(term: string): Promise<ImageRef[]> {
    // Images attached directly to the term, plus images on references tagged
    // with it (reference images are stored once, not per tag).
    return this.db
      .prepare(
        `SELECT i.id, i.term, i.reference_id AS referenceId, i.url,
                i.added_by AS addedBy, i.created_at AS createdAt
         FROM images i
         LEFT JOIN bookmark_tags bt ON bt.bookmark_id = i.reference_id
         WHERE i.term = ? OR bt.tag = ?
         GROUP BY i.id
         ORDER BY i.created_at ASC`,
      )
      .all(term, term) as ImageRef[];
  }

  async searchTerms(query: string, limit = 25): Promise<string[]> {
    const like = `%${query.toLowerCase()}%`;
    const rows = this.db
      .prepare(
        `SELECT display, MIN(term) AS term FROM (
           SELECT display, term FROM definitions
           UNION ALL
           SELECT display, tag AS term FROM bookmark_tags
         ) WHERE term LIKE ? GROUP BY term ORDER BY display ASC LIMIT ?`,
      )
      .all(like, limit) as { display: string }[];
    return rows.map((r) => r.display);
  }

  close(): void {
    this.db.close();
  }
}
