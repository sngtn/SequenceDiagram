/* jshint -W072 */ // Allow several required modules
define([
	'core/EventObject',
	'./Parser',
	'./Generator',
	'./Renderer',
	'./Exporter',
	'./CodeMirrorHints',
	'./themes/BaseTheme',
	'./themes/Basic',
	'./themes/Monospace',
	'./themes/Chunky',
	'./themes/Sketch',
], (
	EventObject,
	Parser,
	Generator,
	Renderer,
	Exporter,
	CMHints,
	BaseTheme,
	BasicTheme,
	MonospaceTheme,
	ChunkyTheme,
	SketchTheme
) => {
	/* jshint +W072 */
	'use strict';

	const themes = [
		new BasicTheme(),
		new MonospaceTheme(),
		new ChunkyTheme(),
		new SketchTheme(SketchTheme.RIGHT),
		new SketchTheme(SketchTheme.LEFT),
	];

	const SharedParser = new Parser();
	const SharedGenerator = new Generator();
	const CMMode = SharedParser.getCodeMirrorMode();

	function registerCodeMirrorMode(CodeMirror, modeName = 'sequence') {
		if(!CodeMirror) {
			CodeMirror = window.CodeMirror;
		}
		CodeMirror.defineMode(modeName, () => CMMode);
		CodeMirror.registerHelper('hint', modeName, CMHints.getHints);
	}

	function addTheme(theme) {
		themes.push(theme);
	}

	function extractCodeFromSVG(svg) {
		const dom = new DOMParser().parseFromString(svg, 'image/svg+xml');
		const meta = dom.querySelector('metadata');
		if(!meta) {
			return '';
		}
		return meta.textContent;
	}

	class SequenceDiagram extends EventObject {
		constructor(code = null, options = {}) {
			super();

			if(code && typeof code === 'object') {
				options = code;
				code = options.code;
			}

			this.registerCodeMirrorMode = registerCodeMirrorMode;

			this.code = code;
			this.parser = SharedParser;
			this.generator = SharedGenerator;
			this.renderer = new Renderer(Object.assign({themes}, options));
			this.exporter = new Exporter();
			this.renderer.addEventForwarding(this);
			this.latestProcessed = null;
			this.isInteractive = false;
			if(options.container) {
				options.container.appendChild(this.dom());
			}
			if(options.interactive) {
				this.addInteractivity();
			}
			if(typeof this.code === 'string') {
				this.render();
			}
		}

		clone(options = {}) {
			return new SequenceDiagram(Object.assign({
				code: this.code,
				container: null,
				themes: this.renderer.getThemes(),
				namespace: null,
				components: this.renderer.components,
				interactive: this.isInteractive,
				SVGTextBlockClass: this.renderer.SVGTextBlockClass,
			}, options));
		}

		set(code = '') {
			if(this.code === code) {
				return;
			}

			this.code = code;
			this.render();
		}

		process(code) {
			const parsed = this.parser.parse(code);
			return this.generator.generate(parsed);
		}

		addTheme(theme) {
			this.renderer.addTheme(theme);
		}

		setHighlight(line) {
			this.renderer.setHighlight(line);
		}

		isCollapsed(line) {
			return this.renderer.isCollapsed(line);
		}

		setCollapsed(line, collapsed = true, {render = true} = {}) {
			if(!this.renderer.setCollapsed(line, collapsed)) {
				return false;
			}
			if(render && this.latestProcessed) {
				this.render(this.latestProcessed);
			}
			return true;
		}

		collapse(line, options) {
			return this.setCollapsed(line, true, options);
		}

		expand(line, options) {
			return this.setCollapsed(line, false, options);
		}

		toggleCollapsed(line, options) {
			return this.setCollapsed(line, !this.isCollapsed(line), options);
		}

		expandAll(options) {
			return this.setCollapsed(null, false, options);
		}

		getThemeNames() {
			return this.renderer.getThemeNames();
		}

		getThemes() {
			return this.renderer.getThemes();
		}

		getSVGSynchronous() {
			return this.exporter.getSVGURL(this.renderer);
		}

		getSVG() {
			return Promise.resolve({
				url: this.getSVGSynchronous(),
				latest: true,
			});
		}

		getCanvas({resolution = 1, size = null} = {}) {
			if(size) {
				this.renderer.width = size.width;
				this.renderer.height = size.height;
			}
			return new Promise((resolve) => {
				this.exporter.getCanvas(this.renderer, resolution, resolve);
			});
		}

		getPNG({resolution = 1, size = null} = {}) {
			if(size) {
				this.renderer.width = size.width;
				this.renderer.height = size.height;
			}
			return new Promise((resolve) => {
				this.exporter.getPNGURL(
					this.renderer,
					resolution,
					(url, latest) => {
						resolve({url, latest});
					}
				);
			});
		}

		getSize() {
			return {
				width: this.renderer.width,
				height: this.renderer.height,
			};
		}

		render(processed = null) {
			const dom = this.renderer.svg();
			const originalParent = dom.parentNode;
			if(!document.body.contains(dom)) {
				if(originalParent) {
					originalParent.removeChild(dom);
				}
				document.body.appendChild(dom);
			}
			try {
				if(!processed) {
					processed = this.process(this.code);
				}
				this.renderer.render(processed);
				this.latestProcessed = processed;
				this.trigger('render', [this]);
			} finally {
				if(dom.parentNode !== originalParent) {
					document.body.removeChild(dom);
					if(originalParent) {
						originalParent.appendChild(dom);
					}
				}
			}
		}

		setContainer(node = null) {
			const dom = this.dom();
			if(dom.parentNode) {
				dom.parentNode.removeChild(dom);
			}
			if(node) {
				node.appendChild(dom);
			}
		}

		addInteractivity() {
			if(this.isInteractive) {
				return;
			}
			this.isInteractive = true;

			this.addEventListener('click', (element) => {
				this.toggleCollapsed(element.ln);
			});
		}

		extractCodeFromSVG(svg) {
			return extractCodeFromSVG(svg);
		}

		dom() {
			return this.renderer.svg();
		}
	}

	function datasetBoolean(value) {
		return value !== undefined && value !== 'false';
	}

	function parseTagOptions(element) {
		return {
			namespace: element.dataset.sdNamespace || null,
			interactive: datasetBoolean(element.dataset.sdInteractive),
		};
	}

	function convert(element, code = null, options = {}) {
		if(element.tagName === 'svg') {
			return null;
		}

		if(code === null) {
			code = element.innerText;
		} else if(typeof code === 'object') {
			options = code;
			code = options.code;
		}

		const tagOptions = parseTagOptions(element);

		const diagram = new SequenceDiagram(
			code,
			Object.assign(tagOptions, options)
		);
		const newElement = diagram.dom();
		element.parentNode.insertBefore(newElement, element);
		element.parentNode.removeChild(element);
		const attrs = element.attributes;
		for(let i = 0; i < attrs.length; ++ i) {
			newElement.setAttribute(
				attrs[i].nodeName,
				attrs[i].nodeValue
			);
		}
		return diagram;
	}

	function convertAll(root = null, className = 'sequence-diagram') {
		if(typeof root === 'string') {
			className = root;
			root = null;
		}
		let elements = null;
		if(root && root.length !== undefined) {
			elements = root;
		} else {
			elements = (root || document).getElementsByClassName(className);
		}
		// Convert from "live" collection to static to avoid infinite loops:
		const els = [];
		for(let i = 0; i < elements.length; ++ i) {
			els.push(elements[i]);
		}
		// Convert elements
		els.forEach((el) => convert(el));
	}

	return Object.assign(SequenceDiagram, {
		Parser,
		Generator,
		Renderer,
		Exporter,
		BaseTheme,
		themes,
		addTheme,
		registerCodeMirrorMode,
		extractCodeFromSVG,
		convert,
		convertAll,
	});
});
