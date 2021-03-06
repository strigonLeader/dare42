import { Hex, Building } from './Hex';
import { Vector2, Group, Raycaster, Vector3, Quaternion, Line, Geometry, LineBasicMaterial, WrapAroundEnding, Color } from 'three';
import { flatten, game, tryRemove, random, groupBy, crossMap } from './index';

export interface HexMap{
	[hash: string]: Hex;
}

interface SuperHex{
	center: Hex;
	radius: Vector3;
}

export interface Triangle{
	hexes: Array<Hex>;
	size: number;
}

export interface Buildings{
	[key: string]: number;
}

interface HexGroupMap{
	[key: string]: Array<Hex>;
}

interface SuperHexMap{
	[key: string]: SuperHex;
}


export class Field {
	triangles: number = 0;
	disaster(){
		for (const warp of this.hexArray.filter(h => h.warp > 0)){
			if (--warp.warp > 0)
				continue;
			warp.building = Building.Tear;
		}

		const targets = this.hexArray.filter(h => h.vulnerable);
		const boostCost = this.hexArray.filter(h => h.building === Building.Spacer && h.boost === 0).length + targets.length / 40;
		console.log(boostCost);

		for (let events = boostCost; events > 0; events--){
			const target = random(targets);
			if (!target){
				break;
			}
			target.warp = 1;
			tryRemove(targets, target);
		}

		if (!this.origin || this.origin.solidity < 1)
			return;

		for(let i = 1, level = 1; level < 50 && i > 0; level++){
			const items = this.origin.adjacents(level).filter(h => h.vulnerable);
			while(items.length){
				const victim = random(items);
				tryRemove(items, victim);
				if(victim){
					victim.warp = 1;
					if(--i <= 0)
						break;
				}
			}
		}
	}

	disasterCount: number = 3;
	smash(raycaster: Raycaster): Hex | void{
		const intersect = raycaster.intersectObjects(flatten(this.hexArray.map(h => h.mesh)))[0];
		if (!intersect)
			return;

		return intersect.object.parent.userData.eventReceptor as Hex;
	}

	group: Group;
	links: Group;
	public hexes: HexMap = {};
	constructor() {
		this.group = new Group();
		this.links = new Group();
		this.group.add(this.links);
		Hex.hover.position.z++;
	}

	public static indexHash(coord : Vector2): string {
		return `x${coord.x | 0}y${coord.y | 0}`;
	}

	public get hexArray(): Array<Hex> {
		return Object.keys(this.hexes).map(key => this.hexes[key]);
	}

	private createHex(coord: Vector2): Hex {
		const hex = new Hex(coord, Math.random() * 0.4 + 0.6 / (Math.pow(((Math.abs(coord.x) + Math.abs(coord.y))) / 6, 2) + 1), this);
		if (hex.indexHash in this.hexes)
			return;
		this.hexes[hex.indexHash] = hex;
		this.group.add(hex.group);
		return hex;
	}

	public hex(x: number, y: number){
		return this.hexes[Field.indexHash(new Vector2(x | 0, y | 0))];
	}

	origin: Hex;

	public generate() {
		const center = this.createHex(new Vector2());
		for(let i = 1; i <= 50; i++){
			for(const vector of center.adjacentVectors(i)){
				const hex = this.createHex(vector);
				if (i === 1)
					hex.solidity = 1;
			}
		}
		const origin = random(center.adjacents(20));
		if (origin){
			origin.building = Building.Origin;
			this.origin = origin;
		}

		this.build(Building.Spacer, this.hex(0, 0));
	}

	public adjacents(hex: Hex, distance = 1): Array<Hex>{
		let adjacents: Array<Hex> = [];
		while(distance > 0){
			adjacents = adjacents.concat(hex.adjacents(distance));
			distance--;
		}
		return adjacents;
	}

	public update (delta: number) {
		const buildings: Array<Hex> = [];
		for(const hex of this.hexArray){
			if (hex.building !== Building.None)
				buildings.push(hex);

			hex.solidity -= 0.5 * delta;
		}

		for(const building of buildings){
			switch(building.building){
				case Building.Spacer:{
					building.solidity += 2 * delta;
					for (const hex of this.adjacents(building, 2 + building.boost)){
						hex.solidity += 2 * delta;
					}
					break;
				}
			}
		}

		for(const hex of this.hexArray)
			hex.update(delta);
		
		if(!this.hexArray.some(h => h.solidity > 0 && h.building === Building.None)){
			game.ui.gameOver(false);
		}
	}

	getTriangles(hex: Hex): Array<Triangle>{
		const groups = groupBy(
			this.hexArray
				.filter(h => h.building === Building.Spacer && h !== hex)
				.map(s => [s.group.position.clone().sub(hex.group.position), s] as [Vector3, Hex]),
			h => h[0].length().toFixed(2).toString()
		);

		let triangles: Array<Triangle> = [];

		for (const group in groups){
			triangles = triangles.concat(crossMap(groups[group])
				.filter(p => Math.abs(Math.PI / 3 - p[0][0].angleTo(p[1][0])) < 0.01)
				.map(p => { return {
					size: p[0][0].length() / (Hex.size * 2),
					hexes: [hex, p[0][1], p[1][1]]
				}})
			);
		}
		return triangles;
	}

	private superHexes: SuperHexMap = {};

	destroySuperHexes(hex: Hex){
		const brokenHexes: Array<string> = [];
		for(const superHex in this.superHexes){
			const direction = this.superHexes[superHex].center.group.position.clone().sub(hex.group.position);
			if (Math.abs(direction.length() - this.superHexes[superHex].radius.length()) >= 0.01)
				continue;
			if (direction.angleTo(this.superHexes[superHex].radius) % (Math.PI / 3) >= 0.01)
				continue;
			brokenHexes.push(superHex);
		}

		for(const hex of brokenHexes){
			delete this.superHexes[hex];
		}
	}

	getSuperHexes(hex: Hex): Array<SuperHex>{
		const groups = groupBy(
			this.hexArray
				.filter(h => h.building === Building.Spacer && h !== hex)
				.map(s => [s.group.position.clone().sub(hex.group.position), s] as [Vector3, Hex]),
			h => h[0].length().toFixed(2).toString()
		);

		let superHexes = [];

		for (const group in groups){
			superHexes = superHexes.concat(crossMap(groups[group])
				.filter(p => Math.abs(Math.PI * 2 / 3 - p[0][0].angleTo(p[1][0])) < 0.01)
				.filter(h => {
					let test = hex.group.position.clone().add(h[0][0]).add(h[1][0]).add(h[0][0]);
					if (this.realWorldHex(test).building !== Building.Spacer)
						return false;
					test.add(h[1][0]);
					if (this.realWorldHex(test).building !== Building.Spacer)
						return false;
					test.sub(h[0][0]);
					if (this.realWorldHex(test).building !== Building.Spacer)
						return false;
					return true;
				}).map(h => {
					const radius = (h[0][0].clone().add(h[1][0]));
					return {
						radius: radius,
						center: this.realWorldHex(radius.clone().add(hex.group.position)),
					} as SuperHex
				})
			);
		}
		return superHexes;
	}

	createSuperHexes(hex: Hex){
		for(const foundHex of this.getSuperHexes(hex)){
			this.superHexes[foundHex.center.indexHash] = foundHex;
		}
	}

	realWorldHex(vector: Vector3): Hex {
		const y = Math.round(vector.y / Hex.radius / 1.5);
		const x = Math.round((vector.x / Hex.size -  Math.abs(y % 2 | 0)) / 2);
		return this.hexes[Field.indexHash(new Vector2(x, y))];
	}

	build(building: Building, hex: Hex): any {
		if(building !== Building.None)
			hex.building = building;

		this.disaster();

		for(const hex of this.hexArray){
			hex.reinforced = false;
		}

		for(const hex in this.superHexes){
			this.superHexes[hex].center.reinforced = true;
			for(const subject of this.adjacents(this.superHexes[hex].center, this.superHexes[hex].radius.length() / (Hex.size * 2) + 1 | 0)){
				subject.reinforced = true;
			}
		}
	}

	showLinks(hex: Hex){
		for (const triangle of this.getTriangles(hex)){
			const geometry = new Geometry();
			geometry.vertices.push(triangle.hexes[0].group.position);
			geometry.vertices.push(triangle.hexes[1].group.position);
			geometry.vertices.push(triangle.hexes[2].group.position);
			geometry.vertices.push(triangle.hexes[0].group.position);
			const lines = new Line(geometry, new LineBasicMaterial( { color: new Color(0.8, 0, 1), linewidth: 3 } ));
			lines.position.z++;
			this.links.add(lines)
		}

		for (const superHex of this.getSuperHexes(hex)){
			const geometry = new Geometry();
			const vertices = this.getVertices(superHex);
			for(const vertex of vertices){
				geometry.vertices.push(vertex);
			}
			geometry.vertices.push(vertices[0]);
			const lines = new Line(geometry, new LineBasicMaterial( { color: new Color(1, 0, 0.6), linewidth: 6 } ));
			lines.position.z++;
			this.links.add(lines);
		}
	}

	getVertices(hex: SuperHex): Array<Vector3>{
		const center = hex.center.group.position.clone();
		const vertices: Array<Vector3> = [];
		for (let i = 0; i <= 6; i++){
			vertices.push(hex.radius.clone().applyAxisAngle(new Vector3(0, 0, 1), Math.PI * i / 3).add(center));
		}
		return vertices;
	}

	hideLinks(): any {
		const children = [].concat(this.links.children);
		for(const child of children)
			this.links.remove(child);
	}
}
