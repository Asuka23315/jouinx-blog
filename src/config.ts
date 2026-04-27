import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "Jouïnx",
	subtitle: "où la jouissance fait jinx",
	lang: "zh_CN", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 280, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	banner: {
		enable: false,
		src: "assets/images/demo-banner.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed
			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		// Leave this array empty to use the default favicon
		// {
		//   src: '/favicon/icon.png',    // Path of the favicon, relative to the /public directory
		//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
		//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
		// }
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		{
			name: "GitHub",
			url: "https://github.com/Asuka23315/jouinx-blog", // Internal links should not include the base path, as it is automatically added
			external: true, // Show an external link icon and will open in a new tab
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "/avatar.mp4", // Path in /public, supports image (.png/.jpg) or video (.mp4/.webm)
	name: "le Jinxé",
	bio: "où la jouissance fait jinx",
	links: [
		{
			name: "Steam",
			icon: "fa6-brands:steam",
			url: "https://steamcommunity.com/profiles/76561199822280116/",
		},
		{
			name: "豆瓣",
			icon: "simple-icons:douban",
			url: "https://www.douban.com/people/242610287/",
		},
		{
			name: "Email",
			icon: "fa6-solid:envelope",
			url: "mailto:4393083@qq.com",
		},
		{
			name: "Bilibili",
			icon: "simple-icons:bilibili",
			url: "https://space.bilibili.com/1693299509",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};

// Giscus 评论配置（基于 GitHub Discussions）
// 1. 在 GitHub 仓库 Settings → General → Features 里勾选 Discussions
// 2. 安装 https://github.com/apps/giscus 到本仓库
// 3. 去 https://giscus.app/zh-CN 填写仓库，选择映射方式 pathname 和分类 General/Comments
//    页面会生成 data-repo-id 和 data-category-id，把它们填到下面
export const giscusConfig = {
	enable: true,
	repo: "Asuka23315/jouinx-blog" as `${string}/${string}`,
	repoId: "R_kgDOSNDR8w",
	category: "Announcements",
	categoryId: "DIC_kwDOSNDR884C7xuL",
	mapping: "pathname", // 文章路径作为 Discussion 标识
	lang: "zh-CN",
	reactionsEnabled: "1",
	inputPosition: "bottom" as "top" | "bottom",
};
