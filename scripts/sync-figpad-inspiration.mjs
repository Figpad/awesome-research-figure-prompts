#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const API_URL = 'https://figpad.ai/api/gallery';
const INSPIRATION_URL = 'https://figpad.ai/inspiration';
const ROOT = new URL('..', import.meta.url).pathname;
const SYNC_DATE = process.env.SYNC_DATE || new Date().toISOString().slice(0, 10);

const CATEGORY_LABELS = {
  'mechanisms-pathways': 'Mechanisms & Pathways',
  'process-workflow': 'Process & Workflow',
  'graphical-abstracts': 'Graphical Abstracts',
  'lab-apparatus': 'Lab Apparatus',
  'micro-structures': 'Micro Structures',
  'systems-networks': 'Systems & Networks',
  'journal-covers': 'Journal Covers',
  'cross-sections-layers': 'Cross-Sections & Layers',
  'environments-ecologies': 'Environments & Ecologies',
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

const CATEGORY_ICONS = {
  'mechanisms-pathways': '🧬',
  'process-workflow': '🔄',
  'graphical-abstracts': '📊',
  'lab-apparatus': '🧪',
  'micro-structures': '🔬',
  'systems-networks': '🕸️',
  'journal-covers': '🎨',
  'cross-sections-layers': '🧱',
  'environments-ecologies': '🌍',
};

const LANGUAGES = [
  { code: 'en', short: 'EN', flag: '🇺🇸', file: 'README.md', default: true },
  { code: 'zh', short: 'ZH', flag: '🇨🇳', file: 'README.zh.md' },
  { code: 'ko', short: 'KO', flag: '🇰🇷', file: 'README.ko.md' },
  { code: 'ja', short: 'JA', flag: '🇯🇵', file: 'README.ja.md' },
  { code: 'es', short: 'ES', flag: '🇪🇸', file: 'README.es.md' },
  { code: 'de', short: 'DE', flag: '🇩🇪', file: 'README.de.md' },
  { code: 'fr', short: 'FR', flag: '🇫🇷', file: 'README.fr.md' },
  { code: 'pt', short: 'PT', flag: '🇧🇷', file: 'README.pt.md' },
  { code: 'ru', short: 'RU', flag: '🇷🇺', file: 'README.ru.md' },
  { code: 'th', short: 'TH', flag: '🇹🇭', file: 'README.th.md' },
];

const TRANSLATIONS = {
  en: {
    languageLabel: 'Languages',
    defaultLabel: 'Default',
    contents: 'Contents',
    introduction: 'Introduction',
    galleryPreview: 'Gallery Preview',
    repositoryLayout: 'Repository Layout',
    howToUse: 'How to Use',
    sync: 'Sync',
    license: 'License',
    categories: 'Categories',
    category: 'Category',
    prompts: 'Prompts',
    collection: 'Collection',
    browse: 'Browse',
    welcome: 'Welcome to the **Awesome Research Figure Prompts** repository! 🤗',
    description:
      'A curated collection of high-quality AI prompts for **research figures, scientific diagrams, graphical abstracts, paper-ready visuals, and academic presentation graphics**.',
    preparing:
      "Whether you're preparing a journal paper, conference poster, thesis defense, grant proposal, or research presentation — this repository helps you turn complex scientific ideas into clear, accurate, and visually compelling figures.",
    findHere: "What you'll find here:",
    findBullets: [
      '🎯 Research-ready prompts for academic figure generation',
      '🧬 Scientific diagram prompts across multiple disciplines',
      '📊 Prompts for paper figures, graphical abstracts, workflows, mechanisms, and concept diagrams',
      '🖼️ Real output examples for selected prompt cases',
      '✍️ Reusable prompt templates for different research scenarios',
      '🌍 Open examples for students, researchers, designers, and AI-assisted science communication',
    ],
    useful:
      'This repository is especially useful for researchers who want to create better visual explanations with AI — not just beautiful images, but figures that communicate scientific ideas clearly.',
    star: 'If you find this useful, consider giving it a star. ⭐',
    tryIt: 'Try it on [FigPad](https://figpad.ai/generate-figure).',
    synced: (date) =>
      `The image and prompt records in this repository were synced from the public [FigPad inspiration library](${INSPIRATION_URL}) on ${date}.`,
    layoutBullets: [
      '`images/<category>/` stores the downloaded figure images.',
      '`categories/<category>.md` contains every image and prompt in that category.',
      '`data/inspirations.json` is the complete machine-readable dataset.',
      '`data/categories.json` contains the category list and counts.',
      '`scripts/sync-figpad-inspiration.mjs` can refresh the static files from FigPad.',
    ],
    howToUseText:
      'Browse a category, pick a figure close to the scientific story you want to tell, then copy and adapt the prompt. Most prompts are intentionally specific: replace the subject, organism, pathway, instrument, or material while keeping the layout, labeling, and visual-quality constraints.',
    syncText:
      'The sync script downloads current FigPad inspiration items, writes JSON metadata, regenerates category pages, and updates all language README files.',
    licenseText:
      'The repository license is [CC0 1.0 Universal](LICENSE). The source inspiration library is FigPad; verify redistribution rights for generated images before publishing mirrors outside your own projects.',
    categoryLabels: CATEGORY_LABELS,
  },
  zh: {
    languageLabel: '语言',
    defaultLabel: '默认',
    contents: '目录',
    introduction: '简介',
    galleryPreview: '图库预览',
    repositoryLayout: '仓库结构',
    howToUse: '如何使用',
    sync: '同步',
    license: '许可证',
    categories: '分类',
    category: '分类',
    prompts: '提示词',
    collection: '合集',
    browse: '浏览',
    welcome: '欢迎来到 **Awesome Research Figure Prompts** 仓库！🤗',
    description:
      '这里收集了高质量 AI 提示词，适用于**科研插图、科学示意图、图文摘要、论文级视觉图和学术演示图形**。',
    preparing:
      '无论你在准备期刊论文、会议海报、毕业答辩、基金申请还是科研汇报，这个仓库都能帮助你把复杂科学想法转化为清晰、准确、富有表现力的图像。',
    findHere: '你可以在这里找到：',
    findBullets: [
      '🎯 面向学术图像生成的研究级提示词',
      '🧬 覆盖多个学科的科学示意图提示词',
      '📊 论文图、图文摘要、流程、机制和概念图提示词',
      '🖼️ 精选提示词案例的真实输出示例',
      '✍️ 适用于不同研究场景的可复用提示词模板',
      '🌍 面向学生、研究者、设计师和 AI 科学传播的开放示例',
    ],
    useful:
      '这个仓库特别适合希望用 AI 创建更好科学视觉解释的研究者：不只是生成漂亮图片，更是生成能清晰传达科学想法的图。',
    star: '如果你觉得有用，欢迎给这个仓库点个星标。⭐',
    tryIt: '在 [FigPad](https://figpad.ai/generate-figure) 上试用。',
    synced: (date) =>
      `本仓库的图片和提示词记录同步自公开的 [FigPad inspiration library](${INSPIRATION_URL})，同步日期：${date}。`,
    layoutBullets: [
      '`images/<category>/` 存放下载的图像文件。',
      '`categories/<category>.md` 包含该分类下的全部图片和提示词。',
      '`data/inspirations.json` 是完整的机器可读数据集。',
      '`data/categories.json` 包含分类列表和数量。',
      '`scripts/sync-figpad-inspiration.mjs` 可从 FigPad 刷新静态文件。',
    ],
    howToUseText:
      '浏览某个分类，选择与你要表达的科研故事相近的图，然后复制并改写提示词。大多数提示词都刻意写得很具体：替换主题、物种、通路、仪器或材料，同时保留布局、标注和视觉质量约束。',
    syncText:
      '同步脚本会下载最新 FigPad 灵感条目，写入 JSON 元数据，重新生成分类页面，并更新所有语言版本的 README。',
    licenseText:
      '本仓库使用 [CC0 1.0 Universal](LICENSE) 许可。源灵感库来自 FigPad；在自己的项目之外发布镜像前，请确认生成图片的再分发权限。',
    categoryLabels: {
      'mechanisms-pathways': '机制与通路',
      'process-workflow': '流程与工作流',
      'graphical-abstracts': '图文摘要',
      'lab-apparatus': '实验装置',
      'micro-structures': '微观结构',
      'systems-networks': '系统与网络',
      'journal-covers': '期刊封面',
      'cross-sections-layers': '剖面与层级',
      'environments-ecologies': '环境与生态',
    },
  },
  ko: {
    languageLabel: '언어',
    defaultLabel: '기본',
    contents: '목차',
    introduction: '소개',
    galleryPreview: '갤러리 미리보기',
    repositoryLayout: '저장소 구성',
    howToUse: '사용 방법',
    sync: '동기화',
    license: '라이선스',
    categories: '카테고리',
    category: '카테고리',
    prompts: '프롬프트',
    collection: '모음',
    browse: '보기',
    welcome: '**Awesome Research Figure Prompts** 저장소에 오신 것을 환영합니다! 🤗',
    description:
      '**연구 그림, 과학 다이어그램, 그래픽 초록, 논문용 시각 자료, 학술 발표 그래픽**을 위한 고품질 AI 프롬프트 모음입니다.',
    preparing:
      '저널 논문, 학회 포스터, 논문 심사, 연구비 제안서, 연구 발표를 준비할 때 복잡한 과학 아이디어를 명확하고 정확하며 설득력 있는 그림으로 바꾸는 데 도움을 줍니다.',
    findHere: '여기에서 찾을 수 있는 것:',
    findBullets: [
      '🎯 학술 그림 생성을 위한 연구용 프롬프트',
      '🧬 여러 분야를 아우르는 과학 다이어그램 프롬프트',
      '📊 논문 그림, 그래픽 초록, 워크플로, 기전, 개념도 프롬프트',
      '🖼️ 선택된 프롬프트 사례의 실제 출력 예시',
      '✍️ 다양한 연구 상황에 재사용할 수 있는 프롬프트 템플릿',
      '🌍 학생, 연구자, 디자이너, AI 기반 과학 커뮤니케이션을 위한 공개 예시',
    ],
    useful:
      '이 저장소는 AI로 더 나은 과학 시각 설명을 만들고 싶은 연구자에게 특히 유용합니다. 단순히 아름다운 이미지를 넘어 과학적 아이디어를 명확하게 전달하는 그림을 목표로 합니다.',
    star: '유용하다면 별표를 눌러 주세요. ⭐',
    tryIt: '[FigPad](https://figpad.ai/generate-figure)에서 사용해 보세요.',
    synced: (date) =>
      `이 저장소의 이미지와 프롬프트 기록은 공개 [FigPad inspiration library](${INSPIRATION_URL})에서 ${date}에 동기화되었습니다.`,
    layoutBullets: [
      '`images/<category>/`에는 다운로드한 그림 이미지가 저장됩니다.',
      '`categories/<category>.md`에는 해당 카테고리의 모든 이미지와 프롬프트가 들어 있습니다.',
      '`data/inspirations.json`은 전체 기계 판독형 데이터셋입니다.',
      '`data/categories.json`에는 카테고리 목록과 개수가 들어 있습니다.',
      '`scripts/sync-figpad-inspiration.mjs`로 FigPad에서 정적 파일을 새로고침할 수 있습니다.',
    ],
    howToUseText:
      '카테고리를 둘러보고 전달하려는 과학적 이야기와 가까운 그림을 고른 뒤 프롬프트를 복사해 수정하세요. 대부분의 프롬프트는 주제, 생물종, 경로, 장비, 재료를 바꾸되 레이아웃, 라벨링, 시각 품질 조건을 유지할 수 있도록 구체적으로 작성되어 있습니다.',
    syncText:
      '동기화 스크립트는 최신 FigPad inspiration 항목을 다운로드하고 JSON 메타데이터를 쓰며 카테고리 페이지와 모든 언어 README 파일을 다시 생성합니다.',
    licenseText:
      '이 저장소의 라이선스는 [CC0 1.0 Universal](LICENSE)입니다. 원본 inspiration 라이브러리는 FigPad이며, 개인 프로젝트 밖으로 생성 이미지를 미러링하기 전에 재배포 권리를 확인하세요.',
    categoryLabels: {
      'mechanisms-pathways': '기전 및 경로',
      'process-workflow': '프로세스 및 워크플로',
      'graphical-abstracts': '그래픽 초록',
      'lab-apparatus': '실험 장비',
      'micro-structures': '미세 구조',
      'systems-networks': '시스템 및 네트워크',
      'journal-covers': '저널 커버',
      'cross-sections-layers': '단면 및 레이어',
      'environments-ecologies': '환경 및 생태',
    },
  },
  ja: {
    languageLabel: '言語',
    defaultLabel: '既定',
    contents: '目次',
    introduction: 'はじめに',
    galleryPreview: 'ギャラリープレビュー',
    repositoryLayout: 'リポジトリ構成',
    howToUse: '使い方',
    sync: '同期',
    license: 'ライセンス',
    categories: 'カテゴリ',
    category: 'カテゴリ',
    prompts: 'プロンプト',
    collection: 'コレクション',
    browse: '表示',
    welcome: '**Awesome Research Figure Prompts** リポジトリへようこそ！🤗',
    description:
      '**研究図、科学ダイアグラム、グラフィカルアブストラクト、論文向けビジュアル、学術発表グラフィック**のための高品質な AI プロンプト集です。',
    preparing:
      'ジャーナル論文、学会ポスター、博士・修士審査、研究費申請、研究発表の準備において、複雑な科学的アイデアを明確で正確、かつ魅力的な図へ変換するのに役立ちます。',
    findHere: 'ここにあるもの:',
    findBullets: [
      '🎯 学術図生成のための研究向けプロンプト',
      '🧬 複数分野にわたる科学ダイアグラムプロンプト',
      '📊 論文図、グラフィカルアブストラクト、ワークフロー、メカニズム、概念図のプロンプト',
      '🖼️ 選択されたプロンプトケースの実際の出力例',
      '✍️ さまざまな研究シナリオで再利用できるプロンプトテンプレート',
      '🌍 学生、研究者、デザイナー、AI 支援の科学コミュニケーション向け公開例',
    ],
    useful:
      'このリポジトリは、AI を使って科学的な説明図をより良く作りたい研究者に特に役立ちます。美しい画像だけでなく、科学的アイデアを明確に伝える図を目指します。',
    star: '役に立ったら、ぜひスターを付けてください。⭐',
    tryIt: '[FigPad](https://figpad.ai/generate-figure) で試す。',
    synced: (date) =>
      `このリポジトリの画像とプロンプト記録は、公開 [FigPad inspiration library](${INSPIRATION_URL}) から ${date} に同期されました。`,
    layoutBullets: [
      '`images/<category>/` にはダウンロードした図画像を保存します。',
      '`categories/<category>.md` には各カテゴリの画像とプロンプトをすべて含みます。',
      '`data/inspirations.json` は完全な機械可読データセットです。',
      '`data/categories.json` にはカテゴリ一覧と件数が含まれます。',
      '`scripts/sync-figpad-inspiration.mjs` で FigPad から静的ファイルを更新できます。',
    ],
    howToUseText:
      'カテゴリを閲覧し、伝えたい科学的ストーリーに近い図を選んで、プロンプトをコピーして調整します。多くのプロンプトは具体的に書かれているため、レイアウト、ラベル、視覚品質の条件を保ちながら、対象、生物種、経路、装置、材料を置き換えられます。',
    syncText:
      '同期スクリプトは最新の FigPad inspiration 項目をダウンロードし、JSON メタデータを書き込み、カテゴリページとすべての言語 README を再生成します。',
    licenseText:
      'このリポジトリのライセンスは [CC0 1.0 Universal](LICENSE) です。元の inspiration ライブラリは FigPad です。生成画像を自身のプロジェクト外でミラー公開する前に、再配布権を確認してください。',
    categoryLabels: {
      'mechanisms-pathways': 'メカニズムと経路',
      'process-workflow': 'プロセスとワークフロー',
      'graphical-abstracts': 'グラフィカルアブストラクト',
      'lab-apparatus': '実験装置',
      'micro-structures': '微細構造',
      'systems-networks': 'システムとネットワーク',
      'journal-covers': 'ジャーナルカバー',
      'cross-sections-layers': '断面とレイヤー',
      'environments-ecologies': '環境と生態系',
    },
  },
  es: {
    languageLabel: 'Idiomas',
    defaultLabel: 'Predeterminado',
    contents: 'Contenido',
    introduction: 'Introducción',
    galleryPreview: 'Vista previa de la galería',
    repositoryLayout: 'Estructura del repositorio',
    howToUse: 'Cómo usar',
    sync: 'Sincronización',
    license: 'Licencia',
    categories: 'Categorías',
    category: 'Categoría',
    prompts: 'Prompts',
    collection: 'Colección',
    browse: 'Ver',
    welcome: '¡Bienvenido al repositorio **Awesome Research Figure Prompts**! 🤗',
    description:
      'Una colección curada de prompts de IA de alta calidad para **figuras de investigación, diagramas científicos, resúmenes gráficos, visuales listos para papers y gráficos de presentaciones académicas**.',
    preparing:
      'Ya sea que prepares un artículo, póster de conferencia, defensa de tesis, propuesta de financiación o presentación de investigación, este repositorio te ayuda a convertir ideas científicas complejas en figuras claras, precisas y visualmente atractivas.',
    findHere: 'Qué encontrarás aquí:',
    findBullets: [
      '🎯 Prompts listos para investigación y generación de figuras académicas',
      '🧬 Prompts de diagramas científicos para múltiples disciplinas',
      '📊 Prompts para figuras de paper, resúmenes gráficos, flujos, mecanismos y diagramas conceptuales',
      '🖼️ Ejemplos reales de salida para casos seleccionados',
      '✍️ Plantillas reutilizables para distintos escenarios de investigación',
      '🌍 Ejemplos abiertos para estudiantes, investigadores, diseñadores y comunicación científica asistida por IA',
    ],
    useful:
      'Este repositorio es especialmente útil para investigadores que quieren crear mejores explicaciones visuales con IA: no solo imágenes bonitas, sino figuras que comuniquen ideas científicas con claridad.',
    star: 'Si te resulta útil, considera darle una estrella. ⭐',
    tryIt: 'Pruébalo en [FigPad](https://figpad.ai/generate-figure).',
    synced: (date) =>
      `Los registros de imágenes y prompts de este repositorio se sincronizaron desde la biblioteca pública [FigPad inspiration library](${INSPIRATION_URL}) el ${date}.`,
    layoutBullets: [
      '`images/<category>/` almacena las imágenes descargadas.',
      '`categories/<category>.md` contiene todas las imágenes y prompts de esa categoría.',
      '`data/inspirations.json` es el conjunto de datos completo en formato legible por máquina.',
      '`data/categories.json` contiene la lista de categorías y sus conteos.',
      '`scripts/sync-figpad-inspiration.mjs` puede actualizar los archivos estáticos desde FigPad.',
    ],
    howToUseText:
      'Explora una categoría, elige una figura cercana a la historia científica que quieres contar y copia/adapta el prompt. La mayoría son deliberadamente específicos: reemplaza el tema, organismo, vía, instrumento o material conservando las restricciones de diseño, rotulado y calidad visual.',
    syncText:
      'El script de sincronización descarga los elementos actuales de FigPad inspiration, escribe metadatos JSON, regenera las páginas de categorías y actualiza todos los README de idioma.',
    licenseText:
      'La licencia del repositorio es [CC0 1.0 Universal](LICENSE). La biblioteca de inspiración original es FigPad; verifica los derechos de redistribución de las imágenes generadas antes de publicar réplicas fuera de tus propios proyectos.',
    categoryLabels: {
      'mechanisms-pathways': 'Mecanismos y vías',
      'process-workflow': 'Procesos y flujos de trabajo',
      'graphical-abstracts': 'Resúmenes gráficos',
      'lab-apparatus': 'Aparatos de laboratorio',
      'micro-structures': 'Microestructuras',
      'systems-networks': 'Sistemas y redes',
      'journal-covers': 'Portadas de revistas',
      'cross-sections-layers': 'Cortes transversales y capas',
      'environments-ecologies': 'Ambientes y ecologías',
    },
  },
  de: {
    languageLabel: 'Sprachen',
    defaultLabel: 'Standard',
    contents: 'Inhalt',
    introduction: 'Einführung',
    galleryPreview: 'Galerievorschau',
    repositoryLayout: 'Repository-Struktur',
    howToUse: 'Verwendung',
    sync: 'Synchronisierung',
    license: 'Lizenz',
    categories: 'Kategorien',
    category: 'Kategorie',
    prompts: 'Prompts',
    collection: 'Sammlung',
    browse: 'Ansehen',
    welcome: 'Willkommen im Repository **Awesome Research Figure Prompts**! 🤗',
    description:
      'Eine kuratierte Sammlung hochwertiger KI-Prompts für **Forschungsabbildungen, wissenschaftliche Diagramme, grafische Abstracts, publikationsreife Visuals und akademische Präsentationsgrafiken**.',
    preparing:
      'Ob Fachartikel, Konferenzposter, Disputation, Förderantrag oder Forschungspräsentation: Dieses Repository hilft dir, komplexe wissenschaftliche Ideen in klare, genaue und visuell überzeugende Abbildungen zu verwandeln.',
    findHere: 'Was du hier findest:',
    findBullets: [
      '🎯 Forschungsreife Prompts für akademische Abbildungen',
      '🧬 Prompts für wissenschaftliche Diagramme in mehreren Disziplinen',
      '📊 Prompts für Paper-Figuren, grafische Abstracts, Workflows, Mechanismen und Konzeptdiagramme',
      '🖼️ Reale Ausgabebeispiele für ausgewählte Prompt-Fälle',
      '✍️ Wiederverwendbare Prompt-Vorlagen für unterschiedliche Forschungsszenarien',
      '🌍 Offene Beispiele für Studierende, Forschende, Designer und KI-gestützte Wissenschaftskommunikation',
    ],
    useful:
      'Dieses Repository ist besonders nützlich für Forschende, die mit KI bessere visuelle Erklärungen erstellen möchten: nicht nur schöne Bilder, sondern Abbildungen, die wissenschaftliche Ideen klar vermitteln.',
    star: 'Wenn es dir hilft, gib dem Repository gern einen Stern. ⭐',
    tryIt: 'Probiere es auf [FigPad](https://figpad.ai/generate-figure) aus.',
    synced: (date) =>
      `Die Bild- und Prompt-Datensätze in diesem Repository wurden am ${date} aus der öffentlichen [FigPad inspiration library](${INSPIRATION_URL}) synchronisiert.`,
    layoutBullets: [
      '`images/<category>/` speichert die heruntergeladenen Abbildungsbilder.',
      '`categories/<category>.md` enthält alle Bilder und Prompts dieser Kategorie.',
      '`data/inspirations.json` ist der vollständige maschinenlesbare Datensatz.',
      '`data/categories.json` enthält die Kategorienliste und Zählwerte.',
      '`scripts/sync-figpad-inspiration.mjs` kann die statischen Dateien von FigPad aktualisieren.',
    ],
    howToUseText:
      'Durchsuche eine Kategorie, wähle eine Abbildung aus, die deiner wissenschaftlichen Geschichte nahekommt, und kopiere bzw. passe den Prompt an. Die meisten Prompts sind bewusst konkret: Ersetze Thema, Organismus, Signalweg, Instrument oder Material und behalte Layout-, Beschriftungs- und Qualitätsvorgaben bei.',
    syncText:
      'Das Synchronisierungsskript lädt aktuelle FigPad-inspiration-Elemente herunter, schreibt JSON-Metadaten, regeneriert Kategorieseiten und aktualisiert alle README-Sprachdateien.',
    licenseText:
      'Die Repository-Lizenz ist [CC0 1.0 Universal](LICENSE). Die ursprüngliche Inspirationsbibliothek stammt von FigPad; prüfe die Weiterverbreitungsrechte generierter Bilder, bevor du Spiegel außerhalb deiner eigenen Projekte veröffentlichst.',
    categoryLabels: {
      'mechanisms-pathways': 'Mechanismen und Signalwege',
      'process-workflow': 'Prozesse und Workflows',
      'graphical-abstracts': 'Grafische Abstracts',
      'lab-apparatus': 'Laborgeräte',
      'micro-structures': 'Mikrostrukturen',
      'systems-networks': 'Systeme und Netzwerke',
      'journal-covers': 'Journal-Cover',
      'cross-sections-layers': 'Querschnitte und Schichten',
      'environments-ecologies': 'Umwelten und Ökologien',
    },
  },
  fr: {
    languageLabel: 'Langues',
    defaultLabel: 'Défaut',
    contents: 'Sommaire',
    introduction: 'Introduction',
    galleryPreview: 'Aperçu de la galerie',
    repositoryLayout: 'Structure du dépôt',
    howToUse: 'Utilisation',
    sync: 'Synchronisation',
    license: 'Licence',
    categories: 'Catégories',
    category: 'Catégorie',
    prompts: 'Prompts',
    collection: 'Collection',
    browse: 'Parcourir',
    welcome: 'Bienvenue dans le dépôt **Awesome Research Figure Prompts** ! 🤗',
    description:
      'Une collection organisée de prompts IA de haute qualité pour **figures de recherche, diagrammes scientifiques, résumés graphiques, visuels prêts pour article et graphiques de présentation académique**.',
    preparing:
      "Que vous prépariez un article, une affiche de conférence, une soutenance, une demande de financement ou une présentation de recherche, ce dépôt vous aide à transformer des idées scientifiques complexes en figures claires, exactes et visuellement convaincantes.",
    findHere: 'Vous y trouverez :',
    findBullets: [
      '🎯 Prompts prêts pour la recherche et la génération de figures académiques',
      '🧬 Prompts de diagrammes scientifiques couvrant plusieurs disciplines',
      '📊 Prompts pour figures d’article, résumés graphiques, workflows, mécanismes et diagrammes conceptuels',
      '🖼️ Exemples de sorties réelles pour certains cas de prompts',
      '✍️ Modèles de prompts réutilisables pour différents scénarios de recherche',
      '🌍 Exemples ouverts pour étudiants, chercheurs, designers et communication scientifique assistée par IA',
    ],
    useful:
      'Ce dépôt est particulièrement utile aux chercheurs qui souhaitent créer de meilleures explications visuelles avec l’IA : pas seulement de belles images, mais des figures qui communiquent clairement les idées scientifiques.',
    star: 'Si cela vous est utile, pensez à mettre une étoile. ⭐',
    tryIt: 'Essayez-le sur [FigPad](https://figpad.ai/generate-figure).',
    synced: (date) =>
      `Les images et prompts de ce dépôt ont été synchronisés depuis la bibliothèque publique [FigPad inspiration library](${INSPIRATION_URL}) le ${date}.`,
    layoutBullets: [
      '`images/<category>/` stocke les images téléchargées.',
      '`categories/<category>.md` contient toutes les images et tous les prompts de cette catégorie.',
      '`data/inspirations.json` est le jeu de données complet lisible par machine.',
      '`data/categories.json` contient la liste des catégories et leurs nombres.',
      '`scripts/sync-figpad-inspiration.mjs` permet de rafraîchir les fichiers statiques depuis FigPad.',
    ],
    howToUseText:
      'Parcourez une catégorie, choisissez une figure proche de l’histoire scientifique que vous souhaitez raconter, puis copiez et adaptez le prompt. La plupart des prompts sont volontairement précis : remplacez le sujet, l’organisme, la voie, l’instrument ou le matériau tout en conservant les contraintes de mise en page, d’étiquetage et de qualité visuelle.',
    syncText:
      'Le script de synchronisation télécharge les éléments FigPad inspiration actuels, écrit les métadonnées JSON, régénère les pages de catégories et met à jour tous les README de langue.',
    licenseText:
      'La licence du dépôt est [CC0 1.0 Universal](LICENSE). La bibliothèque d’inspiration source est FigPad ; vérifiez les droits de redistribution des images générées avant de publier des miroirs hors de vos propres projets.',
    categoryLabels: {
      'mechanisms-pathways': 'Mécanismes et voies',
      'process-workflow': 'Processus et workflows',
      'graphical-abstracts': 'Résumés graphiques',
      'lab-apparatus': 'Appareils de laboratoire',
      'micro-structures': 'Microstructures',
      'systems-networks': 'Systèmes et réseaux',
      'journal-covers': 'Couvertures de revues',
      'cross-sections-layers': 'Coupes et couches',
      'environments-ecologies': 'Environnements et écologies',
    },
  },
  pt: {
    languageLabel: 'Idiomas',
    defaultLabel: 'Padrão',
    contents: 'Conteúdo',
    introduction: 'Introdução',
    galleryPreview: 'Prévia da galeria',
    repositoryLayout: 'Estrutura do repositório',
    howToUse: 'Como usar',
    sync: 'Sincronização',
    license: 'Licença',
    categories: 'Categorias',
    category: 'Categoria',
    prompts: 'Prompts',
    collection: 'Coleção',
    browse: 'Ver',
    welcome: 'Bem-vindo ao repositório **Awesome Research Figure Prompts**! 🤗',
    description:
      'Uma coleção selecionada de prompts de IA de alta qualidade para **figuras de pesquisa, diagramas científicos, resumos gráficos, visuais prontos para artigos e gráficos de apresentações acadêmicas**.',
    preparing:
      'Se você está preparando um artigo, pôster de conferência, defesa de tese, proposta de financiamento ou apresentação de pesquisa, este repositório ajuda a transformar ideias científicas complexas em figuras claras, precisas e visualmente atraentes.',
    findHere: 'O que você encontrará aqui:',
    findBullets: [
      '🎯 Prompts prontos para pesquisa e geração de figuras acadêmicas',
      '🧬 Prompts de diagramas científicos em várias disciplinas',
      '📊 Prompts para figuras de artigos, resumos gráficos, fluxos, mecanismos e diagramas conceituais',
      '🖼️ Exemplos reais de saída para casos selecionados',
      '✍️ Modelos reutilizáveis de prompts para diferentes cenários de pesquisa',
      '🌍 Exemplos abertos para estudantes, pesquisadores, designers e comunicação científica assistida por IA',
    ],
    useful:
      'Este repositório é especialmente útil para pesquisadores que desejam criar melhores explicações visuais com IA: não apenas imagens bonitas, mas figuras que comuniquem ideias científicas com clareza.',
    star: 'Se isso for útil, considere deixar uma estrela. ⭐',
    tryIt: 'Experimente no [FigPad](https://figpad.ai/generate-figure).',
    synced: (date) =>
      `Os registros de imagens e prompts deste repositório foram sincronizados da biblioteca pública [FigPad inspiration library](${INSPIRATION_URL}) em ${date}.`,
    layoutBullets: [
      '`images/<category>/` armazena as imagens baixadas.',
      '`categories/<category>.md` contém todas as imagens e prompts dessa categoria.',
      '`data/inspirations.json` é o conjunto de dados completo legível por máquina.',
      '`data/categories.json` contém a lista de categorias e contagens.',
      '`scripts/sync-figpad-inspiration.mjs` pode atualizar os arquivos estáticos a partir do FigPad.',
    ],
    howToUseText:
      'Explore uma categoria, escolha uma figura próxima da história científica que deseja contar e copie/adapte o prompt. A maioria dos prompts é intencionalmente específica: substitua o tema, organismo, via, instrumento ou material mantendo as restrições de layout, rotulagem e qualidade visual.',
    syncText:
      'O script de sincronização baixa os itens atuais do FigPad inspiration, escreve metadados JSON, regenera páginas de categorias e atualiza todos os README de idioma.',
    licenseText:
      'A licença do repositório é [CC0 1.0 Universal](LICENSE). A biblioteca de inspiração original é o FigPad; verifique os direitos de redistribuição das imagens geradas antes de publicar espelhos fora dos seus próprios projetos.',
    categoryLabels: {
      'mechanisms-pathways': 'Mecanismos e vias',
      'process-workflow': 'Processos e fluxos de trabalho',
      'graphical-abstracts': 'Resumos gráficos',
      'lab-apparatus': 'Aparelhos de laboratório',
      'micro-structures': 'Microestruturas',
      'systems-networks': 'Sistemas e redes',
      'journal-covers': 'Capas de periódicos',
      'cross-sections-layers': 'Cortes transversais e camadas',
      'environments-ecologies': 'Ambientes e ecologias',
    },
  },
  ru: {
    languageLabel: 'Языки',
    defaultLabel: 'По умолчанию',
    contents: 'Содержание',
    introduction: 'Введение',
    galleryPreview: 'Предпросмотр галереи',
    repositoryLayout: 'Структура репозитория',
    howToUse: 'Как использовать',
    sync: 'Синхронизация',
    license: 'Лицензия',
    categories: 'Категории',
    category: 'Категория',
    prompts: 'Промпты',
    collection: 'Коллекция',
    browse: 'Открыть',
    welcome: 'Добро пожаловать в репозиторий **Awesome Research Figure Prompts**! 🤗',
    description:
      'Подборка качественных AI-промптов для **научных иллюстраций, научных диаграмм, графических аннотаций, визуалов для статей и академических презентаций**.',
    preparing:
      'Если вы готовите журнальную статью, постер для конференции, защиту диссертации, грантовую заявку или исследовательскую презентацию, этот репозиторий поможет превратить сложные научные идеи в ясные, точные и визуально выразительные схемы.',
    findHere: 'Что здесь есть:',
    findBullets: [
      '🎯 Готовые для исследований промпты для академических иллюстраций',
      '🧬 Промпты для научных диаграмм в разных дисциплинах',
      '📊 Промпты для рисунков к статьям, графических аннотаций, процессов, механизмов и концептуальных схем',
      '🖼️ Реальные примеры результатов для выбранных кейсов',
      '✍️ Повторно используемые шаблоны промптов для разных исследовательских сценариев',
      '🌍 Открытые примеры для студентов, исследователей, дизайнеров и AI-коммуникации науки',
    ],
    useful:
      'Репозиторий особенно полезен исследователям, которые хотят создавать более понятные визуальные объяснения с помощью AI: не просто красивые изображения, а схемы, ясно передающие научные идеи.',
    star: 'Если это полезно, поставьте звезду. ⭐',
    tryIt: 'Попробуйте в [FigPad](https://figpad.ai/generate-figure).',
    synced: (date) =>
      `Изображения и промпты в этом репозитории синхронизированы из публичной [FigPad inspiration library](${INSPIRATION_URL}) ${date}.`,
    layoutBullets: [
      '`images/<category>/` хранит загруженные изображения.',
      '`categories/<category>.md` содержит все изображения и промпты этой категории.',
      '`data/inspirations.json` — полный машиночитаемый набор данных.',
      '`data/categories.json` содержит список категорий и количество элементов.',
      '`scripts/sync-figpad-inspiration.mjs` обновляет статические файлы из FigPad.',
    ],
    howToUseText:
      'Откройте категорию, выберите рисунок, близкий к вашей научной истории, затем скопируйте и адаптируйте промпт. Большинство промптов намеренно конкретны: замените объект, организм, путь, прибор или материал, сохранив требования к компоновке, подписям и визуальному качеству.',
    syncText:
      'Скрипт синхронизации загружает актуальные элементы FigPad inspiration, записывает JSON-метаданные, заново генерирует страницы категорий и обновляет README на всех языках.',
    licenseText:
      'Лицензия репозитория — [CC0 1.0 Universal](LICENSE). Исходная библиотека вдохновения — FigPad; перед публикацией зеркал вне ваших проектов проверьте права на распространение сгенерированных изображений.',
    categoryLabels: {
      'mechanisms-pathways': 'Механизмы и пути',
      'process-workflow': 'Процессы и рабочие потоки',
      'graphical-abstracts': 'Графические аннотации',
      'lab-apparatus': 'Лабораторное оборудование',
      'micro-structures': 'Микроструктуры',
      'systems-networks': 'Системы и сети',
      'journal-covers': 'Обложки журналов',
      'cross-sections-layers': 'Срезы и слои',
      'environments-ecologies': 'Среды и экологии',
    },
  },
  th: {
    languageLabel: 'ภาษา',
    defaultLabel: 'ค่าเริ่มต้น',
    contents: 'สารบัญ',
    introduction: 'บทนำ',
    galleryPreview: 'ตัวอย่างแกลเลอรี',
    repositoryLayout: 'โครงสร้างรีโพซิทอรี',
    howToUse: 'วิธีใช้',
    sync: 'ซิงค์',
    license: 'สัญญาอนุญาต',
    categories: 'หมวดหมู่',
    category: 'หมวดหมู่',
    prompts: 'พรอมป์ต์',
    collection: 'ชุดข้อมูล',
    browse: 'เปิดดู',
    welcome: 'ยินดีต้อนรับสู่รีโพซิทอรี **Awesome Research Figure Prompts**! 🤗',
    description:
      'คอลเลกชันพรอมป์ต์ AI คุณภาพสูงสำหรับ **ภาพประกอบงานวิจัย แผนภาพวิทยาศาสตร์ graphical abstract ภาพพร้อมใช้ในบทความ และกราฟิกสำหรับงานนำเสนอวิชาการ**',
    preparing:
      'ไม่ว่าคุณกำลังเตรียมบทความวารสาร โปสเตอร์ประชุม การป้องกันวิทยานิพนธ์ ข้อเสนอโครงการ หรือการนำเสนองานวิจัย รีโพซิทอรีนี้ช่วยเปลี่ยนแนวคิดวิทยาศาสตร์ที่ซับซ้อนให้เป็นภาพที่ชัดเจน ถูกต้อง และน่าสนใจ',
    findHere: 'สิ่งที่คุณจะพบ:',
    findBullets: [
      '🎯 พรอมป์ต์พร้อมใช้สำหรับการสร้างภาพวิชาการ',
      '🧬 พรอมป์ต์แผนภาพวิทยาศาสตร์ครอบคลุมหลายสาขา',
      '📊 พรอมป์ต์สำหรับภาพในบทความ graphical abstract เวิร์กโฟลว์ กลไก และแผนภาพแนวคิด',
      '🖼️ ตัวอย่างผลลัพธ์จริงจากบางกรณี',
      '✍️ เทมเพลตพรอมป์ต์ที่นำกลับมาใช้ได้ในสถานการณ์วิจัยต่าง ๆ',
      '🌍 ตัวอย่างเปิดสำหรับนักศึกษา นักวิจัย นักออกแบบ และการสื่อสารวิทยาศาสตร์ด้วย AI',
    ],
    useful:
      'รีโพซิทอรีนี้เหมาะสำหรับนักวิจัยที่ต้องการสร้างคำอธิบายเชิงภาพด้วย AI ให้ดีขึ้น ไม่ใช่แค่ภาพสวย แต่เป็นภาพที่สื่อสารแนวคิดวิทยาศาสตร์ได้ชัดเจน',
    star: 'ถ้าคุณเห็นว่ามีประโยชน์ ลองกดดาวให้รีโพซิทอรีนี้ ⭐',
    tryIt: 'ลองใช้บน [FigPad](https://figpad.ai/generate-figure)',
    synced: (date) =>
      `บันทึกรูปภาพและพรอมป์ต์ในรีโพซิทอรีนี้ซิงค์จาก [FigPad inspiration library](${INSPIRATION_URL}) แบบสาธารณะ เมื่อ ${date}`,
    layoutBullets: [
      '`images/<category>/` เก็บไฟล์ภาพที่ดาวน์โหลดมา',
      '`categories/<category>.md` รวมรูปภาพและพรอมป์ต์ทั้งหมดในหมวดหมู่นั้น',
      '`data/inspirations.json` คือชุดข้อมูลทั้งหมดแบบอ่านด้วยเครื่องได้',
      '`data/categories.json` มีรายชื่อหมวดหมู่และจำนวนรายการ',
      '`scripts/sync-figpad-inspiration.mjs` ใช้รีเฟรชไฟล์ static จาก FigPad',
    ],
    howToUseText:
      'เลือกดูหมวดหมู่ เลือกรูปที่ใกล้เคียงกับเรื่องราววิทยาศาสตร์ที่ต้องการเล่า แล้วคัดลอกและปรับพรอมป์ต์ พรอมป์ต์ส่วนใหญ่ตั้งใจเขียนให้เฉพาะเจาะจง: เปลี่ยนหัวข้อ สิ่งมีชีวิต เส้นทาง เครื่องมือ หรือวัสดุ โดยยังคงข้อกำหนดด้านเลย์เอาต์ ป้ายกำกับ และคุณภาพภาพไว้',
    syncText:
      'สคริปต์ซิงค์จะดาวน์โหลดรายการ FigPad inspiration ล่าสุด เขียน metadata JSON สร้างหน้าหมวดหมู่ใหม่ และอัปเดต README ทุกภาษา',
    licenseText:
      'รีโพซิทอรีนี้ใช้สัญญาอนุญาต [CC0 1.0 Universal](LICENSE) แหล่ง inspiration มาจาก FigPad โปรดตรวจสอบสิทธิ์การเผยแพร่ซ้ำของภาพที่สร้างขึ้นก่อนเผยแพร่มิเรอร์นอกโปรเจกต์ของคุณเอง',
    categoryLabels: {
      'mechanisms-pathways': 'กลไกและเส้นทาง',
      'process-workflow': 'กระบวนการและเวิร์กโฟลว์',
      'graphical-abstracts': 'บทคัดย่อกราฟิก',
      'lab-apparatus': 'อุปกรณ์ห้องปฏิบัติการ',
      'micro-structures': 'โครงสร้างระดับจุลภาค',
      'systems-networks': 'ระบบและเครือข่าย',
      'journal-covers': 'ปกวารสาร',
      'cross-sections-layers': 'ภาพตัดขวางและชั้น',
      'environments-ecologies': 'สิ่งแวดล้อมและนิเวศวิทยา',
    },
  },
};

function byCategoryThenOrder(a, b) {
  const categoryDelta =
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (categoryDelta !== 0) return categoryDelta;
  if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  }
  return String(a.id).localeCompare(String(b.id));
}

function asSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function shortId(id) {
  return String(id).replace(/-/g, '').slice(0, 8);
}

function imageExtension(url, contentType) {
  const fromPath = extname(new URL(url).pathname).toLowerCase();
  if (fromPath && fromPath.length <= 6) return fromPath;
  if (contentType?.includes('jpeg')) return '.jpg';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('png')) return '.png';
  return '.png';
}

function titleFromPrompt(prompt) {
  const firstLine = String(prompt || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return 'Untitled research figure';

  const cleaned = firstLine
    .replace(/^Create a scientific figure about:\s*/i, '')
    .replace(/^Create a graphical abstract for\s*/i, '')
    .replace(/^Create a technical cutaway diagram of\s*/i, '')
    .replace(/^Create an?\s*/i, '')
    .replace(/\.$/, '')
    .trim();

  return cleaned.length > 120 ? `${cleaned.slice(0, 117).trim()}...` : cleaned;
}

function markdownFence(text) {
  const value = String(text || '').trim();
  const fence = value.includes('```') ? '````' : '```';
  return `${fence}text\n${value}\n${fence}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderReadmeGalleryItem(item, caseNumber, translation) {
  const outputLabel = translation.output || 'Output';
  const promptLabel = translation.prompt || 'Prompt';

  return `<a id="${item.category}-${shortId(item.id)}"></a>

#### Case ${caseNumber}: ${item.title}

<table>
  <tr>
    <th>${outputLabel}</th>
  </tr>
  <tr>
    <td><img src="${item.image}" width="520" alt="${escapeHtml(item.title)}"></td>
  </tr>
</table>

**${promptLabel}:**

${markdownFence(item.prompt)}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} ${url}`);
  }
  return response.json();
}

async function fetchAllItems() {
  const items = [];
  let cursor = null;

  do {
    const url = new URL(API_URL);
    url.searchParams.set('category', 'all');
    url.searchParams.set('limit', '200');
    url.searchParams.set('includePrompt', 'true');
    if (cursor) url.searchParams.set('cursor', cursor);

    const payload = await fetchJson(url);
    if (payload.code !== 0) {
      throw new Error(`FigPad API returned code ${payload.code}: ${payload.message}`);
    }

    items.push(...payload.data);
    cursor = payload.meta?.nextCursor || null;
  } while (cursor);

  return items.sort(byCategoryThenOrder);
}

async function downloadImage(url, outputPath) {
  try {
    const existing = await readFile(outputPath);
    if (existing.length > 0) return;
  } catch {
    // Missing files are expected on the first sync.
  }

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Image download failed: ${response.status} ${response.statusText} ${url}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await pipeline(response.body, createWriteStream(outputPath));
}

function normalizeItems(items) {
  return items.map((item, index) => {
    const title = titleFromPrompt(item.prompt);
    const number = String(item.sortOrder ?? index + 1).padStart(3, '0');
    const fileBase = `${number}-${asSlug(title) || shortId(item.id)}-${shortId(item.id)}`;
    const ext = imageExtension(item.imageUrl, item.contentType);
    const imagePath = `images/${item.category}/${fileBase}${ext}`;

    return {
      id: item.id,
      category: item.category,
      categoryLabel: CATEGORY_LABELS[item.category] || item.category,
      title,
      prompt: item.prompt,
      image: imagePath,
      sourceImageUrl: item.imageUrl,
      sourceThumbnailUrl: item.thumbnailUrl,
      aspectRatio: item.aspectRatio || null,
      sortOrder: item.sortOrder ?? null,
      source: INSPIRATION_URL,
    };
  });
}

function categoryCounts(items) {
  return CATEGORY_ORDER.map((slug) => ({
    slug,
    label: CATEGORY_LABELS[slug],
    count: items.filter((item) => item.category === slug).length,
    file: `categories/${slug}.md`,
  })).filter((category) => category.count > 0);
}

function categoryLabel(category, translation) {
  return translation.categoryLabels?.[category.slug] || category.label;
}

function renderLanguageSwitcher(activeCode) {
  const activeTranslation = TRANSLATIONS[activeCode] || TRANSLATIONS.en;
  const links = LANGUAGES.map((language) => {
    const label = `${language.flag} ${language.short}${
      language.default ? ` (${activeTranslation.defaultLabel})` : ''
    }`;
    if (language.code === activeCode) return `**${label}**`;
    return `[${label}](${language.file})`;
  }).join(' | ');

  return `<div align="center">

**${activeTranslation.languageLabel}:** ${links}

</div>`;
}

function renderReadme(items, categories, language = LANGUAGES[0]) {
  const translation = TRANSLATIONS[language.code] || TRANSLATIONS.en;
  const total = items.length;
  const caseNumbers = new Map(
    items.map((item, index) => [item.id, String(index + 1).padStart(3, '0')])
  );

  const gallery = categories
    .map((category) => {
      const label = categoryLabel(category, translation);
      const icon = CATEGORY_ICONS[category.slug] || '🔎';
      const entries = items
        .filter((item) => item.category === category.slug)
        .map((item) =>
          renderReadmeGalleryItem(item, caseNumbers.get(item.id), translation)
        )
        .join('\n\n');

      return `<a id="${category.slug}"></a>

<details>
<summary><strong>${icon} ${label}</strong> (${category.count} prompts)</summary>

### ${label}

${entries}

</details>`;
    })
    .join('\n\n');

  const contents = [
    `- 🍌 [${translation.introduction}](#introduction)`,
    ...categories.map(
      (category) =>
        `- ${CATEGORY_ICONS[category.slug] || '🔎'} [${categoryLabel(
          category,
          translation
        )}](#${category.slug})`
    ),
    `- 🖼️ [${translation.galleryPreview}](#gallery-preview)`,
    `- 📁 [${translation.repositoryLayout}](#repository-layout)`,
    `- 🚀 [${translation.howToUse}](#how-to-use)`,
    `- 🔄 [${translation.sync}](#sync)`,
    `- 📄 [${translation.license}](#license)`,
  ].join('\n');

  return `# Awesome Research Figure Prompts 🧬🎨 [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

<p align="center">
  <img src="images/awesome-research-figure-prompts-hero.png" alt="Awesome Research Figure Prompts hero banner">
</p>

<div align="center">

[![License: CC0](https://img.shields.io/badge/License-CC0_1.0-lightgrey.svg)](LICENSE)
[![Prompts](https://img.shields.io/badge/Prompts-${total}_Research_Figures-111111)](README.md)
[![Categories](https://img.shields.io/badge/Categories-${categories.length}_Scientific_Styles-2f6f7e)](README.md)
[![Source](https://img.shields.io/badge/Source-FigPad_Inspiration-3b82f6)](${INSPIRATION_URL})

</div>

${renderLanguageSwitcher(language.code)}

<a id="contents"></a>

## ${translation.contents}

${contents}

<a id="introduction"></a>

## 🍌 ${translation.introduction}

${translation.welcome}

${translation.description}

${translation.preparing}

**${translation.findHere}**

${translation.findBullets.map((bullet) => `- ${bullet}`).join('\n')}

${translation.useful}

${translation.star}

${translation.tryIt}

${translation.synced(SYNC_DATE)}

<a id="gallery-preview"></a>

## ${translation.galleryPreview}

${gallery}

<a id="repository-layout"></a>

## ${translation.repositoryLayout}

${translation.layoutBullets.map((bullet) => `- ${bullet}`).join('\n')}

<a id="how-to-use"></a>

## ${translation.howToUse}

${translation.howToUseText}

<a id="sync"></a>

## ${translation.sync}

\`\`\`bash
node scripts/sync-figpad-inspiration.mjs
\`\`\`

${translation.syncText}

<a id="license"></a>

## ${translation.license}

${translation.licenseText}
`;
}

function renderCategoryPage(category, items) {
  const entries = items.filter((item) => item.category === category.slug);
  const body = entries
    .map((item, index) => {
      const caseNumber = String(index + 1).padStart(3, '0');
      return `## ${item.title}

![${item.title}](../${item.image})

**Prompt**

${markdownFence(item.prompt)}

**Metadata**

| Field | Value |
| :-- | :-- |
| ID | \`${item.id}\` |
| Category | ${item.categoryLabel} |
| Aspect ratio | ${item.aspectRatio || 'Unknown'} |
| Source image | [Open original](${item.sourceImageUrl}) |

`;
    })
    .join('\n');

  return `# ${category.label}

[Back to README](../README.md)

${entries.length} research figure prompts synced from [FigPad inspiration](${INSPIRATION_URL}).

${body}`;
}

async function readExistingData() {
  const inspirations = JSON.parse(
    await readFile(join(ROOT, 'data', 'inspirations.json'), 'utf8')
  );
  const categoryData = JSON.parse(
    await readFile(join(ROOT, 'data', 'categories.json'), 'utf8')
  );

  return {
    items: inspirations.items,
    categories: categoryData.categories,
  };
}

async function writeReadmes(items, categories) {
  for (const language of LANGUAGES) {
    await writeFile(
      join(ROOT, language.file),
      renderReadme(items, categories, language)
    );
  }
}

async function main() {
  if (process.argv.includes('--readme-only')) {
    const { items, categories } = await readExistingData();
    await writeReadmes(items, categories);
    process.stdout.write(
      `Done. Updated ${LANGUAGES.length} README language files.\n`
    );
    return;
  }

  const rawItems = await fetchAllItems();
  const items = normalizeItems(rawItems);
  const categories = categoryCounts(items);

  await rm(join(ROOT, 'images'), { recursive: true, force: true });
  await rm(join(ROOT, 'categories'), { recursive: true, force: true });
  await rm(join(ROOT, 'data'), { recursive: true, force: true });

  await mkdir(join(ROOT, 'images'), { recursive: true });
  await mkdir(join(ROOT, 'categories'), { recursive: true });
  await mkdir(join(ROOT, 'data'), { recursive: true });

  for (const item of items) {
    const outputPath = join(ROOT, item.image);
    process.stdout.write(`Downloading ${basename(outputPath)}\n`);
    await downloadImage(item.sourceImageUrl, outputPath);
  }

  await writeFile(
    join(ROOT, 'data', 'inspirations.json'),
    `${JSON.stringify(
      {
        source: INSPIRATION_URL,
        syncedAt: SYNC_DATE,
        total: items.length,
        items,
      },
      null,
      2
    )}\n`
  );

  await writeFile(
    join(ROOT, 'data', 'categories.json'),
    `${JSON.stringify(
      {
        source: INSPIRATION_URL,
        syncedAt: SYNC_DATE,
        total: categories.length,
        categories,
      },
      null,
      2
    )}\n`
  );

  for (const category of categories) {
    await writeFile(
      join(ROOT, category.file),
      renderCategoryPage(category, items)
    );
  }

  await writeReadmes(items, categories);

  process.stdout.write(
    `Done. Synced ${items.length} items across ${categories.length} categories and ${LANGUAGES.length} languages.\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
