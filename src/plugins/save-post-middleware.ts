/**
 * Vite 开发中间件：在本地 dev 模式下处理文章读写端点
 *   - POST /api/save-post   写入 src/content/posts/<slug>.md
 *   - POST /api/delete-post 删除 src/content/posts/<slug>.md
 *
 * 仅在 pnpm dev 模式下生效。生产构建后这些端点不存在。
 */
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

function escapeYaml(s: string): string {
	return JSON.stringify(s);
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
