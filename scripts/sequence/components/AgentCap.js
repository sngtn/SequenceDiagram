define([
	'./BaseComponent',
	'core/ArrayUtilities',
	'svg/SVGUtilities',
	'svg/SVGShapes',
], (
	BaseComponent,
	array,
	svg,
	SVGShapes
) => {
	'use strict';

	class CapBox {
		separation({label}, env) {
			const config = env.theme.agentCap.box;
			const width = (
				env.textSizer.measure(config.labelAttrs, label).width +
				config.padding.left +
				config.padding.right
			);

			return {
				left: width / 2,
				right: width / 2,
				radius: width / 2,
			};
		}

		topShift({label}, env) {
			const config = env.theme.agentCap.box;
			const height = (
				env.textSizer.measureHeight(config.labelAttrs, label) +
				config.padding.top +
				config.padding.bottom
			);
			return Math.max(0, height - config.arrowBottom);
		}

		render(y, {x, label}, env) {
			const config = env.theme.agentCap.box;
			const {height} = SVGShapes.renderBoxedText(label, {
				x,
				y,
				padding: config.padding,
				boxAttrs: config.boxAttrs,
				labelAttrs: config.labelAttrs,
				boxLayer: env.shapeLayer,
				labelLayer: env.labelLayer,
				SVGTextBlockClass: env.SVGTextBlockClass,
			});

			return {
				lineTop: 0,
				lineBottom: height,
				height,
			};
		}
	}

	class CapCross {
		separation(agentInfo, env) {
			const config = env.theme.agentCap.cross;
			return {
				left: config.size / 2,
				right: config.size / 2,
				radius: 0,
			};
		}

		topShift(agentInfo, env) {
			const config = env.theme.agentCap.cross;
			return config.size / 2;
		}

		render(y, {x}, env) {
			const config = env.theme.agentCap.cross;
			const d = config.size / 2;

			env.shapeLayer.appendChild(svg.make('path', Object.assign({
				'd': (
					'M ' + (x - d) + ' ' + y +
					' L ' + (x + d) + ' ' + (y + d * 2) +
					' M ' + (x + d) + ' ' + y +
					' L ' + (x - d) + ' ' + (y + d * 2)
				),
			}, config.attrs)));

			return {
				lineTop: d,
				lineBottom: d,
				height: d * 2,
			};
		}
	}

	class CapBar {
		separation({label}, env) {
			const config = env.theme.agentCap.box;
			const width = (
				env.textSizer.measure(config.labelAttrs, label).width +
				config.padding.left +
				config.padding.right
			);

			return {
				left: width / 2,
				right: width / 2,
				radius: width / 2,
			};
		}

		topShift(agentInfo, env) {
			const config = env.theme.agentCap.bar;
			return config.attrs.height / 2;
		}

		render(y, {x, label}, env) {
			const configB = env.theme.agentCap.box;
			const config = env.theme.agentCap.bar;
			const width = (
				env.textSizer.measure(configB.labelAttrs, label).width +
				configB.padding.left +
				configB.padding.right
			);

			env.shapeLayer.appendChild(svg.make('rect', Object.assign({
				'x': x - width / 2,
				'y': y,
				'width': width,
			}, config.attrs)));

			return {
				lineTop: 0,
				lineBottom: config.attrs.height,
				height: config.attrs.height,
			};
		}
	}

	class CapFade {
		separation({currentRad}) {
			return {
				left: currentRad,
				right: currentRad,
				radius: currentRad,
			};
		}

		topShift(agentInfo, env, isBegin) {
			const config = env.theme.agentCap.fade;
			return isBegin ? config.height : 0;
		}

		render(y, {x, label}, env, isBegin) {
			const config = env.theme.agentCap.fade;

			const gradID = isBegin ? 'fadeIn' : 'fadeOut';

			env.addDef(gradID, () => {
				const grad = svg.make('linearGradient', {
					'id': gradID,
					'x1': '0%',
					'y1': isBegin ? '100%' : '0%',
					'x2': '0%',
					'y2': isBegin ? '0%' : '100%',
				});
				grad.appendChild(svg.make('stop', {
					'offset': '0%',
					'stop-color': config.colVisible,
				}));
				grad.appendChild(svg.make('stop', {
					'offset': '100%',
					'stop-color': config.colHidden,
				}));
				return grad;
			});

			env.shapeLayer.appendChild(svg.make('line', Object.assign({
				'x1': x,
				'y1': y,
				'x2': x + 0.0001, // Chrome bug
				'y2': y + config.height,
				'stroke': 'url(#' + gradID + ')',
			}, config.attrs)));

			return {
				lineTop: 0,
				lineBottom: config.height,
				height: config.height,
			};
		}
	}

	class CapNone {
		separation({currentRad}) {
			return {
				left: currentRad,
				right: currentRad,
				radius: currentRad,
			};
		}

		topShift(agentInfo, env) {
			const config = env.theme.agentCap.none;
			return config.height;
		}

		render(y, agentInfo, env) {
			const config = env.theme.agentCap.none;
			return {
				lineTop: config.height,
				lineBottom: 0,
				height: config.height,
			};
		}
	}

	const AGENT_CAPS = {
		'box': new CapBox(),
		'cross': new CapCross(),
		'bar': new CapBar(),
		'fade': new CapFade(),
		'none': new CapNone(),
	};

	class AgentCap extends BaseComponent {
		constructor(begin) {
			super();
			this.begin = begin;
		}

		separationPre({mode, agentNames}, env) {
			agentNames.forEach((name) => {
				const agentInfo = env.agentInfos.get(name);
				const cap = AGENT_CAPS[mode];
				const sep = cap.separation(agentInfo, env, this.begin);
				env.addSpacing(name, sep);
				agentInfo.currentMaxRad = Math.max(
					agentInfo.currentMaxRad,
					sep.radius
				);
			});
		}

		separation({mode, agentNames}, env) {
			if(this.begin) {
				array.mergeSets(env.visibleAgents, agentNames);
			} else {
				array.removeAll(env.visibleAgents, agentNames);
			}
		}

		renderPre({mode, agentNames}, env) {
			let maxTopShift = 0;
			agentNames.forEach((name) => {
				const agentInfo = env.agentInfos.get(name);
				const cap = AGENT_CAPS[mode];
				const topShift = cap.topShift(agentInfo, env, this.begin);
				maxTopShift = Math.max(maxTopShift, topShift);

				const r = cap.separation(agentInfo, env, this.begin).radius;
				agentInfo.currentMaxRad = Math.max(agentInfo.currentMaxRad, r);
			});
			return {
				agentNames,
				topShift: maxTopShift,
			};
		}

		render({mode, agentNames}, env) {
			let maxEnd = 0;
			agentNames.forEach((name) => {
				const agentInfo = env.agentInfos.get(name);
				const cap = AGENT_CAPS[mode];
				const topShift = cap.topShift(agentInfo, env, this.begin);
				const y0 = env.primaryY - topShift;
				const shifts = cap.render(
					y0,
					agentInfo,
					env,
					this.begin
				);
				maxEnd = Math.max(maxEnd, y0 + shifts.height);
				if(this.begin) {
					env.drawAgentLine(name, y0 + shifts.lineBottom);
				} else {
					env.drawAgentLine(name, y0 + shifts.lineTop, true);
				}
			});
			return maxEnd + env.theme.actionMargin;
		}
	}

	BaseComponent.register('agent begin', new AgentCap(true));
	BaseComponent.register('agent end', new AgentCap(false));

	return AgentCap;
});
