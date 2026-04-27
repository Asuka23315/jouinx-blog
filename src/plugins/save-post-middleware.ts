/**
 * Vite 开发中间件：在本地 dev 模式下处理文章读写端点
 *   - POST /api/save-post     写入 src/content/posts/<slug>.md
 *   - POST /api/delete-post   删除 src/content/posts/<slug>.md
 *   - GET  /api/load-post     读取并解析 src/content/posts/<slug>.md
 *
 * 仅在 pnpm dev 模式下生效。生产构建后这些端点不存在。
 */
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

function escapeYaml(s: string): string {
	return JSON.stringify(s);
}

// 极简 frontmatter 解析器:只覆盖我们自己写出的格式
// (escapeYaml = JSON.stringify,所以字符串都用双引号),
// 以及 Sveltia CMS 的 yaml-frontmatter 输出。
function parseFrontmatter(raw: string): {
	fm: Record<string, unknown>;
	body: string;
} {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) return { fm: {}, body: raw };
	const fmRaw = m[1];
	const body = m[2].replace(/^\r?\n+/, "");

	const fm: Record<string, unknown> = {};
	const lines = fmRaw.split(/\r?\n/);
	const unquote = (v: string): string => {
		const t = v.trim();
		if (
			(t.startsWith('"') && t.endsWith('"')) ||
			(t.startsWith("'") && t.endsWith("'"))
		) {
			try {
				return JSON.parse(t.replace(/^'|'$/g, '"'));
			} catch {
				return t.slice(1, -1);
			}
		}
		return t;
	};

	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		const m1 = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
		if (!m1) {
			i++;
			continue;
		}
		const key = m1[1];
		const valueStr = m1[2];

		// 列表块:`tags:` 后面跟着 `  - "xxx"`
		if (valueStr === "" && i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) {
			const items: string[] = [];
			i++;
			while (i < lines.length && /^\s+-\s+(.+)$/.test(lines[i])) {
				const im = lines[i].match(/^\s+-\s+(.+)$/);
				if (im) items.push(unquote(im[1]));
				i++;
			}
			fm[key] = items;
			continue;
		}

		const t = valueStr.trim();
		let v: unknown;
		if (t === "true") v = true;
		else if (t === "false") v = false;
		else v = unquote(t);
		fm[key] = v;
		i++;
	}
	return { fm, body };
}

function slugify(input: string): string {
	return (input || "")
		.trim()
		.toLowerCase()
		.replace(/[\s　]+/g, "-")
		.replace(/[^a-z0-9一-鿿\-_]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

const POSTS_DIR = path.join(process.cwd(), "src", "content", "posts");

// 防止路径穿越：解析后必须仍在 posts 目录里
function resolvePostPath(slug: string): string | null {
	if (!slug || typeof slug !== "string") return null;
	if (!/^[a-z0-9一-鿿\-_]+$/i.test(slug)) return null;
	const full = path.resolve(POSTS_DIR, `${slug}.md`);
	if (!full.startsWith(POSTS_DIR + path.sep)) return null;
	return full;
}

export function savePostPlugin(): Plugin {
	return {
		name: "jouinx:save-post",
		configureServer(server: ViteDevServer) {
			server.middlewares.use("/api/save-post", async (req, res) => {
				if (req.method !== "POST") {
					res.statusCode = 405;
					res.setHeader("Allow", "POST");
					res.end("Method Not Allowed");
					return;
				}

				try {
					const chunks: Buffer[] = [];
					for await (const chunk of req) {
						chunks.push(chunk as Buffer);
					}
					const raw = Buffer.concat(chunks).toString("utf-8");
					const data = raw ? JSON.parse(raw) : {};

					const {
						title,
						slug: slugIn,
						published,
						updated,
						draft,
						description,
						image,
						tags,
						category,
						author,
						body,
					} = data ?? {};

					const send = (status: number, payload: Record<string, unknown>) => {
						res.statusCode = status;
						res.setHeader("Content-Type", "application/json");
						res.end(JSON.stringify(payload));
					};

					if (!title || typeof title !== "string") {
						return send(400, { error: "标题不能为空" });
					}
					if (!body || typeof body !== "string") {
						return send(400, { error: "正文不能为空" });
					}

					const slug = slugify(slugIn || title);
					if (!slug) {
						return send(400, { error: "无法生成有效的 slug" });
					}
					const filePath = resolvePostPath(slug);
					if (!filePath) {
						return send(400, { error: "非法 slug" });
					}

					const today = new Date().toISOString().slice(0, 10);
					const pubDate =
						typeof published === "string" && published.length > 0
							? published
							: today;

					const lines: string[] = ["---"];
					lines.push(`title: ${escapeYaml(title)}`);
					lines.push(`published: ${pubDate}`);
					if (updated) lines.push(`updated: ${updated}`);
					if (draft === true) lines.push("draft: true");
					if (description) lines.push(`description: ${escapeYaml(description)}`);
					if (image) lines.push(`image: ${escapeYaml(image)}`);
					if (Array.isArray(tags) && tags.length > 0) {
						lines.push("tags:");
						for (const t of tags) {
							if (typeof t === "string" && t.trim() !== "") {
								lines.push(`  - ${escapeYaml(t.trim())}`);
							}
						}
					}
					if (category) lines.push(`category: ${escapeYaml(category)}`);
					if (author) lines.push(`author: ${escapeYaml(author)}`);
					lines.push("---", "", String(body).trim(), "");

					const fileContent = lines.join("\n");

					await writeFile(filePath, fileContent, "utf-8");

					send(200, { success: true, slug, path: filePath });
				} catch (e: unknown) {
					const message = e instanceof Error ? e.message : String(e);
					res.statusCode = 500;
					res.setHeader("Content-Type", "application/json");
					res.end(JSON.stringify({ error: message }));
				}
			});

			server.middlewares.use("/api/load-post", async (req, res) => {
				if (req.method !== "GET") {
					res.statusCode = 405;
					res.setHeader("Allow", "GET");
					res.end("Method Not Allowed");
					return;
				}

				const send = (status: number, payload: Record<string, unknown>) => {
					res.statusCode = status;
					res.setHeader("Content-Type", "application/json");
					res.end(JSON.stringify(payload));
				};

				try {
					const url = new URL(req.url || "/", "http://localhost");
					const slug = url.searchParams.get("slug") || "";
					const filePath = resolvePostPath(slug);
					if (!filePath) {
						return send(400, { error: "非法 slug" });
					}

					const raw = await readFile(filePath, "utf-8");
					const { fm, body } = parseFrontmatter(raw);
					const fmStr = (k: string) =>
						typeof fm[k] === "string" ? (fm[k] as string) : "";

					send(200, {
						slug,
						title: fmStr("title"),
						published: fmStr("published"),
						updated: fmStr("updated"),
						draft: fm.draft === true,
						description: fmStr("description"),
						image: fmStr("image"),
						tags: Array.isArray(fm.tags) ? fm.tags : [],
						category: fmStr("category"),
						author: fmStr("author"),
						body,
					});
				} catch (e: unknown) {
					const code = (e as NodeJS.ErrnoException)?.code;
					if (code === "ENOENT") {
						return send(404, { error: "文章文件不存在" });
					}
					const message = e instanceof Error ? e.message : String(e);
					send(500, { error: message });
				}
			});

			server.middlewares.use("/api/delete-post", async (req, res) => {
				if (req.method !== "POST") {
					res.statusCode = 405;
					res.setHeader("Allow", "POST");
					res.end("Method Not Allowed");
					return;
				}

				const send = (status: number, payload: Record<string, unknown>) => {
					res.statusCode = status;
					res.setHeader("Content-Type", "application/json");
					res.end(JSON.stringify(payload));
				};

				try {
					const chunks: Buffer[] = [];
					for await (const chunk of req) {
						chunks.push(chunk as Buffer);
					}
					const raw = Buffer.concat(chunks).toString("utf-8");
					const data = raw ? JSON.parse(raw) : {};
					const { slug } = data ?? {};

					const filePath = resolvePostPath(slug);
					if (!filePath) {
						return send(400, { error: "非法 slug" });
					}

					await unlink(filePath);
					send(200, { success: true, slug, path: filePath });
				} catch (e: unknown) {
					const code = (e as NodeJS.ErrnoException)?.code;
					if (code === "ENOENT") {
						return send(404, { error: "文章文件不存在" });
					}
					const message = e instanceof Error ? e.message : String(e);
					res.statusCode = 500;
					res.setHeader("Content-Type", "application/json");
					res.end(JSON.stringify({ error: message }));
				}
			});
		},
	};
}
