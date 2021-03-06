import { Field } from './Field';
import $ from 'jquery';
import styles from '../styles/main.sass';
import { Vector2, Raycaster, Box2, MeshBasicMaterial, BoxGeometry, WebGLRenderer, Scene, PerspectiveCamera, Mesh, Object3D, Clock, OrthographicCamera, Vector3 } from 'three';
import { flatten } from './index';
import { UI } from './UI';
import { canvas } from '../styles/main.sass';
import { Hex, Building } from './Hex';

export interface EventReceptor{
	onMouseEnter(event: JQuery.Event<HTMLCanvasElement, null>);
	onMouseOut(event: JQuery.Event<HTMLCanvasElement, null>);
	onClick(event: JQuery.Event<HTMLCanvasElement, null>);
	update(delta: number);
}

export class Game {
	body: JQuery<HTMLElement>;
	canvas: JQuery<HTMLElement>;
	camera: THREE.OrthographicCamera;
	scenexport;
	scene: THREE.Scene;
	renderer: THREE.WebGLRenderer;
	cube: THREE.Mesh;
	field: Field;
	rendererElement: JQuery<HTMLCanvasElement>;
	raycaster: THREE.Raycaster;
	canvasSize: THREE.Vector2;
	ui: UI;
	hoverItem: EventReceptor | void;
	clock: Clock;
	constructor() { }
	public init() {
		this.body = $(`<div/>`);
		$('body').on('contextmenu', 'canvas', function(e){ return false; });
		this.canvas = $(`<div class="${styles.canvas}"/>`);
		this.body.append(this.canvas);
		this.ui = new UI(this.body, this.canvas);
		$('body').append(this.body);
		this.scene = new Scene();
		this.camera = new OrthographicCamera(-10, 10, -10, 10, 0, 1000);
		this.updateCamera();
		this.camera.position.z = 5;
		this.renderer = new WebGLRenderer();
		this.canvasSize = new Vector2(this.canvas.width(), this.canvas.width() / 16.0 * 9);
		this.renderer.setSize(this.canvasSize.x, this.canvasSize.y);
		this.canvas.get()[0].appendChild(this.renderer.domElement);
		this.raycaster = new Raycaster();
		this.rendererElement = $(this.renderer.domElement);
		this.rendererElement.mousemove(e => this.onMouseMove(e));
		this.rendererElement.mousedown(e => this.onMouseDown(e));
		$('body').mousemove(e => this.moveCamera(e));
		$('body').mouseup(e => this.onMouseUp(e));
		$(window).on('wheel', e => this.onScroll(e))
		this.rendererElement.click(e => this.onClick(e));
		var geometry = new BoxGeometry(1, 1, 1);
		var material = new MeshBasicMaterial({ color: 0x00ff00 });
		this.cube = new Mesh(geometry, material);
		this.field = new Field();
		this.field.generate();
		this.scene.add(this.field.group);
		this.clock = new Clock(true);
		this.renderer.render(this.scene, this.camera);
	}
	private zoom: number = 20;
	private readonly cameraRadiusLimit = Hex.size * 35 ;

	private updateCamera(){
		this.camera.left = -this.zoom / 2;
		this.camera.right = this.zoom / 2;
		this.camera.top = this.zoom * 9 / 16 / 2;
		this.camera.bottom =  -this.zoom * 9 / 16 / 2;
		this.camera.updateProjectionMatrix();
	}

	private get viewBox(): Box2{
		return new Box2(
			new Vector2(
				this.camera.position.x + this.camera.left - 1,
				this.camera.position.y + this.camera.bottom - 1
			),
			new Vector2(
				this.camera.position.x + this.camera.right + 1,
				this.camera.position.y + this.camera.top + 1
			)
		);
	}

	private mouse(event: JQuery.Event<HTMLCanvasElement, null>): Vector2 {
		return new Vector2(event.offsetX / this.canvasSize.x * 2 - 1, event.offsetY / this.canvasSize.y * -2 + 1);
	}
	
	onMouseMove(event: JQuery.Event<HTMLCanvasElement, null>): any {

		this.raycaster.setFromCamera(this.mouse(event), this.camera);

		const eventReceptor = this.field.smash(this.raycaster);
		if (this.hoverItem){
			if (this.hoverItem === eventReceptor)
				return;
			this.hoverItem.onMouseOut(event);
		}
		
		this.hoverItem = eventReceptor;

		if (this.hoverItem)
			this.hoverItem.onMouseEnter(event);
	}

	dragged: boolean = false;
	moveCamera(event: JQuery.Event<HTMLElement, null>){
		if (this.drag){
			this.dragged = true;
			const viewBox = this.viewBox;
			const size = viewBox.getSize(new Vector2())
			const newPosition = new Vector2(event.clientX, event.clientY);
			this.camera.position.add(
				new Vector3(
					-size.x * (newPosition.x - this.drag.x) / this.canvas.width(),
					size.y * (newPosition.y - this.drag.y) / this.canvas.height(),
					0
				)
			);

			this.camera.position.clampLength(0, this.cameraRadiusLimit);

			this.drag = newPosition;
		}
	}

	private drag: Vector2;

	onMouseDown(event: JQuery.Event<HTMLCanvasElement, null>): any {
		this.drag = new Vector2(event.clientX, event.clientY);
	}

	onMouseUp(event: JQuery.Event<HTMLElement, null>): any {
		this.drag = null;
	}

	onClick(event: JQuery.Event<HTMLCanvasElement, null>){
		if(this.dragged){
			this.dragged = false;
			return;
		}

		this.raycaster.setFromCamera(this.mouse(event), this.camera);

		const eventReceptor = this.field.smash(this.raycaster);
		if(eventReceptor)
			eventReceptor.onClick(event);
	}

	onScroll(event: JQuery.Event<Window, null>){
		const realEvent = event.originalEvent as any;
		const target = Math.min(40, Math.max(10, this.zoom+Math.min(5, realEvent.deltaY)));
		if (target === this.zoom)
			return;
		this.zoom = target;
		this.updateCamera();
	}
	
	private animate() {
		requestAnimationFrame(() => this.animate());
		this.update(this.clock.getDelta());
		this.renderer.render(this.scene, this.camera);
	}

	update(delta: number): any {
		this.field.update(delta);
		if (this.hoverItem)
			this.hoverItem.update(delta);
	}

	started: boolean = false;
	public start() {
		if(this.started)
			return;
		this.started = true;
		this.animate();
	}

	wait(): any {
		this.field.build(Building.None, null);
	}
}