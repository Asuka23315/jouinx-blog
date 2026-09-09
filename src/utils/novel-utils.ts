import { getCollection } from "astro:content";

export type NovelChapter = {
	chapter: number;
	title: string;
	slug: string;
};

export type NovelSeries = {
	series: string;
	chapters: NovelChapter[];
};

type NovelPostLike = {
	slug: string;
	data: {
		title: string;
		series?: string;
		chapter?: number;
	};
};

/**
 * 从已按 draft 规则筛选过的文章里，把带 series + chapter 的文章聚合成系列。
 * 章节按 chapter 升序排列；返回顺序按系列名排序，保证输出稳定。
 */
export function collectNovelSeries(posts: NovelPostLike[]): NovelSeries[] {
	const bySeries = new Map<string, NovelChapter[]>();

	for (const post of posts) {
		const series = post.data.series?.trim();
		const chapter = post.data.chapter;
		if (!series || typeof chapter !== "number" || !Number.isInteger(chapter) || chapter <= 0) {
			continue;
		}
		const novelChapter: NovelChapter = {
			chapter,
			title: post.data.title,
			slug: post.slug,
		};
		const chapters = bySeries.get(series);
		if (chapters) {
			chapters.push(novelChapter);
		} else {
			bySeries.set(series, [novelChapter]);
		}
	}

	return [...bySeries.entries()]
		.map(([series, chapters]) => ({
			series,
			chapters: chapters.sort((a, b) => a.chapter - b.chapter),
		}))
		.sort((a, b) => a.series.localeCompare(b.series));
}

/**
 * 获取所有小说系列。生产构建时遵循项目现有的 draft 处理逻辑。
 */
export async function getNovelSeries(): Promise<NovelSeries[]> {
	const posts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const seriesList = collectNovelSeries(posts);
	warnDuplicateNovelChapters(seriesList);
	return seriesList;
}

/** 同一系列里出现重复 chapter 时，在构建日志里给出明确警告。 */
export function warnDuplicateNovelChapters(seriesList: NovelSeries[]): void {
	for (const series of seriesList) {
		const seen = new Set<number>();
		const duplicates = new Set<number>();
		for (const chapter of series.chapters) {
			if (seen.has(chapter.chapter)) {
				duplicates.add(chapter.chapter);
			}
			seen.add(chapter.chapter);
		}
		if (duplicates.size > 0) {
			console.warn(
				`[novels] 系列《${series.series}》存在重复章节号: ${[...duplicates].sort((a, b) => a - b).join(", ")}`,
			);
		}
	}
}
