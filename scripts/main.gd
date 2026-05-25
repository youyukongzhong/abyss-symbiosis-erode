extends Node2D

const PLAYER_SCENE := preload("res://scenes/Player.tscn")
const ENEMY_SCENE := preload("res://scenes/Enemy.tscn")
const PROJECTILE_SCENE := preload("res://scenes/Projectile.tscn")
const LOOT_SCENE := preload("res://scenes/Loot.tscn")
const MUTATION_DATA := preload("res://scripts/mutation_data.gd")

const WORLD_SIZE := Vector2(3200.0, 2200.0)
const EXIT_POSITION := Vector2(2960.0, 1940.0)
const EXIT_RADIUS := 94.0

@onready var world_layer: Node2D = $World
@onready var loot_layer: Node2D = $LootLayer
@onready var bullet_layer: Node2D = $BulletLayer
@onready var enemy_layer: Node2D = $EnemyLayer
@onready var player_layer: Node2D = $PlayerLayer
@onready var camera: Camera2D = $Camera2D

var rng := RandomNumberGenerator.new()
var player
var enemies: Array = []
var loot_items: Array = []
var player_bullets: Array = []
var enemy_bullets: Array = []
var puddles: Array = []
var hallucinations: Array = []
var slashes: Array = []
var patches: Array = []
var props: Array = []

var state := "playing"
var erosion := 0.0
var spawn_timer := 0.8
var hallucination_timer := 5.0
var extraction_active := false
var extraction_time := 60.0
var extraction_spawn_timer := 0.0
var message_timer := 0.0

var hud := {}
var mutation_panel: PanelContainer
var mutation_cards: HBoxContainer
var result_panel: PanelContainer
var result_title: Label
var result_body: Label

func _ready() -> void:
	rng.randomize()
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = int(WORLD_SIZE.x)
	camera.limit_bottom = int(WORLD_SIZE.y)
	_create_ui()
	_new_run()

func _physics_process(delta: float) -> void:
	if player == null:
		return

	player.aim_position = get_global_mouse_position()

	if state == "mutation" or state == "game_over":
		_update_camera()
		_update_ui()
		queue_redraw()
		return

	message_timer = maxf(0.0, message_timer - delta)
	erosion = clampf(erosion + delta * (0.08 if extraction_active else 0.035), 0.0, 100.0)
	player.current_erosion = erosion
	player.global_position.x = clampf(player.global_position.x, player.radius, WORLD_SIZE.x - player.radius)
	player.global_position.y = clampf(player.global_position.y, player.radius, WORLD_SIZE.y - player.radius)

	for enemy in enemies.duplicate():
		if is_instance_valid(enemy):
			enemy.update_ai(player.global_position, delta)

	_update_projectiles(delta)
	_update_loot(delta)
	_update_puddles(delta)
	_update_slashes(delta)
	_update_spawning(delta)
	_update_extraction(delta)
	_update_hallucinations(delta)
	_update_camera()
	_update_ui()

	if player.hp <= 0.0:
		_show_result(false)

	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_E and state == "playing":
			if player.global_position.distance_to(EXIT_POSITION) <= EXIT_RADIUS + player.radius:
				_start_extraction()

func _draw() -> void:
	_draw_floor()
	_draw_exit()
	_draw_puddles()
	_draw_hallucinations()
	_draw_slashes()

func _new_run() -> void:
	state = "playing"
	erosion = 0.0
	spawn_timer = 0.8
	hallucination_timer = 5.0
	extraction_active = false
	extraction_time = 60.0
	extraction_spawn_timer = 0.0
	puddles.clear()
	hallucinations.clear()
	slashes.clear()
	patches.clear()
	props.clear()
	enemies.clear()
	loot_items.clear()
	player_bullets.clear()
	enemy_bullets.clear()

	_clear_node(player_layer)
	_clear_node(enemy_layer)
	_clear_node(bullet_layer)
	_clear_node(loot_layer)

	_build_world_data()
	player = PLAYER_SCENE.instantiate()
	player_layer.add_child(player)
	player.global_position = Vector2(220.0, 220.0)
	player.fired.connect(_spawn_player_bullet)
	player.slash.connect(_handle_slash)

	for i in range(18):
		_spawn_enemy(_pick(["charger", "charger", "spitter"]), Vector2(rng.randf_range(420.0, 2700.0), rng.randf_range(360.0, 1750.0)))

	for i in range(26):
		_spawn_loot(_pick(["gene", "gene", "flesh", "syringe", "organ"]), Vector2(rng.randf_range(280.0, 2880.0), rng.randf_range(260.0, 1900.0)))

	mutation_panel.visible = false
	result_panel.visible = false
	_update_camera()
	_update_ui()

func _clear_node(node: Node) -> void:
	for child in node.get_children():
		child.queue_free()

func _build_world_data() -> void:
	for i in range(58):
		patches.append({
			"position": Vector2(rng.randf_range(120.0, WORLD_SIZE.x - 120.0), rng.randf_range(120.0, WORLD_SIZE.y - 120.0)),
			"radius": rng.randf_range(34.0, 118.0),
			"tone": _pick(["green", "red", "amber"]),
			"wobble": rng.randf_range(0.0, TAU),
		})

	for i in range(42):
		props.append({
			"position": Vector2(rng.randf_range(120.0, WORLD_SIZE.x - 120.0), rng.randf_range(120.0, WORLD_SIZE.y - 120.0)),
			"size": Vector2(rng.randf_range(34.0, 88.0), rng.randf_range(22.0, 70.0)),
			"rotation": rng.randf_range(-0.2, 0.2),
			"type": _pick(["tank", "crate", "console"]),
		})

func _spawn_enemy(kind: String, position: Vector2, elite := false) -> void:
	var enemy = ENEMY_SCENE.instantiate()
	enemy_layer.add_child(enemy)
	enemy.global_position = position.clamp(Vector2(70.0, 70.0), WORLD_SIZE - Vector2(70.0, 70.0))
	enemy.configure(kind, elite)
	enemy.died.connect(_on_enemy_died)
	enemy.shot.connect(_spawn_enemy_bullet)
	enemy.melee_hit.connect(_on_enemy_melee_hit)
	enemies.append(enemy)

func _spawn_loot(kind: String, position: Vector2, explicit_value := -1) -> void:
	var value := explicit_value
	if value < 0:
		if kind == "flesh":
			value = rng.randi_range(12, 24)
		elif kind == "gene":
			value = rng.randi_range(6, 18)
		elif kind == "syringe":
			value = rng.randi_range(22, 40)
		else:
			value = rng.randi_range(28, 42)

	var item = LOOT_SCENE.instantiate()
	loot_layer.add_child(item)
	item.global_position = position
	item.setup(kind, value)
	loot_items.append(item)

func _spawn_player_bullet(origin: Vector2, direction: Vector2, payload: Dictionary) -> void:
	var bullet = PROJECTILE_SCENE.instantiate()
	bullet_layer.add_child(bullet)
	bullet.setup(origin, direction, payload, false)
	player_bullets.append(bullet)

func _spawn_enemy_bullet(origin: Vector2, direction: Vector2, payload: Dictionary) -> void:
	var bullet = PROJECTILE_SCENE.instantiate()
	bullet_layer.add_child(bullet)
	bullet.setup(origin, direction, payload, true)
	enemy_bullets.append(bullet)

func _on_enemy_melee_hit(amount: float) -> void:
	erosion = clampf(erosion + player.receive_damage(amount, 1.8), 0.0, 100.0)

func _on_enemy_died(enemy) -> void:
	if enemies.has(enemy):
		enemies.erase(enemy)

	var position = enemy.global_position
	_spawn_loot("flesh", position + _random_offset(12.0), enemy.xp_value)
	if rng.randf() < (0.68 if enemy.enemy_type == "merc" else 0.42):
		_spawn_loot("gene", position + _random_offset(24.0))
	if rng.randf() < 0.08:
		_spawn_loot("syringe", position + _random_offset(28.0))
	if rng.randf() < (0.22 if enemy.elite else 0.06):
		_spawn_loot("organ", position + _random_offset(30.0))

	enemy.queue_free()

func _update_projectiles(delta: float) -> void:
	for bullet in player_bullets.duplicate():
		if not is_instance_valid(bullet) or bullet.life <= 0.0:
			player_bullets.erase(bullet)
			continue

		for enemy in enemies.duplicate():
			if not is_instance_valid(enemy):
				continue
			if bullet.global_position.distance_to(enemy.global_position) > bullet.radius + enemy.radius:
				continue

			var weak_hit := false
			if not enemy.weak_broken and enemy.enemy_type != "merc":
				weak_hit = bullet.global_position.distance_to(enemy.weakpoint_global()) < enemy.radius * 0.55

			var crit_multiplier = 2.25 + player.crit_bonus if weak_hit else 1.0
			enemy.hurt(bullet.damage * crit_multiplier, weak_hit)
			if bullet.poison:
				puddles.append({
					"position": enemy.global_position,
					"radius": 44.0,
					"life": 3.2,
					"damage": 6.5 * player.damage_multiplier(),
				})

			bullet.pierce -= 1
			if bullet.pierce < 0:
				bullet.life = 0.0
				bullet.queue_free()
				player_bullets.erase(bullet)
				break

	for bullet in enemy_bullets.duplicate():
		if not is_instance_valid(bullet) or bullet.life <= 0.0:
			enemy_bullets.erase(bullet)
			continue
		if bullet.global_position.distance_to(player.global_position) <= bullet.radius + player.radius:
			erosion = clampf(erosion + player.receive_damage(bullet.damage, 1.3), 0.0, 100.0)
			bullet.life = 0.0
			bullet.queue_free()
			enemy_bullets.erase(bullet)

func _update_loot(delta: float) -> void:
	for item in loot_items.duplicate():
		if not is_instance_valid(item):
			loot_items.erase(item)
			continue

		var item_distance = item.global_position.distance_to(player.global_position)
		var can_bag = item.kind == "flesh" or item.kind == "syringe" or player.bag < player.bag_capacity
		if item_distance < 118.0 and can_bag:
			var pull := 280.0 if item.kind == "flesh" else 160.0
			item.global_position = item.global_position.move_toward(player.global_position, pull * delta)

		if item.global_position.distance_to(player.global_position) <= player.radius + item.radius + 4.0:
			if _collect_loot(item):
				loot_items.erase(item)
				item.queue_free()

func _collect_loot(item) -> bool:
	if item.kind == "flesh":
		if player.gain_xp(item.value):
			_open_mutation_choices()
		erosion = clampf(erosion + 1.6, 0.0, 100.0)
		return true

	if item.kind == "syringe":
		player.hp = minf(player.max_hp, player.hp + float(item.value))
		return true

	var bag_cost = 2 if item.kind == "organ" else 1
	if player.bag + bag_cost > player.bag_capacity:
		message_timer = 1.0
		return false

	player.bag += bag_cost
	if item.kind == "gene":
		player.genes += item.value
		erosion = clampf(erosion + rng.randf_range(4.0, 8.0), 0.0, 100.0)
	elif item.kind == "organ":
		if player.gain_xp(item.value):
			_open_mutation_choices()
		player.genes += int(item.value / 3)
		erosion = clampf(erosion + rng.randf_range(8.0, 14.0), 0.0, 100.0)

	if player.has_trait("hunger_maw"):
		player.hp = minf(player.max_hp, player.hp + 5.0)
	return true

func _update_puddles(delta: float) -> void:
	for puddle in puddles.duplicate():
		puddle["life"] -= delta
		for enemy in enemies:
			if is_instance_valid(enemy) and enemy.global_position.distance_to(puddle["position"]) < puddle["radius"] + enemy.radius:
				enemy.hurt(float(puddle["damage"]) * delta, false)
		if puddle["life"] <= 0.0:
			puddles.erase(puddle)

func _handle_slash(origin: Vector2, angle: float, radius: float, slash_damage: float) -> void:
	slashes.append({
		"position": origin,
		"angle": angle,
		"radius": radius,
		"life": 0.16,
		"max_life": 0.16,
	})

	for enemy in enemies:
		if not is_instance_valid(enemy):
			continue
		var to_enemy = enemy.global_position - origin
		if to_enemy.length() < radius + enemy.radius and _angle_distance(angle, to_enemy.angle()) < 0.75:
			enemy.hurt(slash_damage, true)

func _update_slashes(delta: float) -> void:
	for slash in slashes.duplicate():
		slash["life"] -= delta
		if slash["life"] <= 0.0:
			slashes.erase(slash)

func _update_spawning(delta: float) -> void:
	if extraction_active:
		return
	spawn_timer -= delta
	if spawn_timer > 0.0:
		return

	var pressure := 3.2 - clampf(erosion / 65.0, 0.0, 1.5)
	spawn_timer = maxf(1.2, pressure)
	if enemies.size() > 34:
		return

	var kind = "merc" if rng.randf() < 0.18 else _pick(["charger", "charger", "spitter"])
	_spawn_enemy(kind, _spawn_point_away_from_player(), erosion > 72.0 and rng.randf() < 0.18)

func _update_extraction(delta: float) -> void:
	if not extraction_active:
		return

	extraction_time -= delta
	extraction_spawn_timer -= delta

	if extraction_spawn_timer <= 0.0:
		var intensity := 0.55 + erosion / 75.0 + float(player.bag) / float(maxi(1, player.bag_capacity))
		extraction_spawn_timer = clampf(1.25 - intensity * 0.28, 0.34, 1.2)
		var count := int(round(rng.randf_range(1.0, 3.0 + intensity)))
		for i in range(count):
			_spawn_enemy(_pick(["charger", "charger", "spitter", "merc"]), _spawn_point_near_exit(), extraction_time < 18.0 and rng.randf() < 0.18)

	if extraction_time <= 0.0:
		_show_result(true)

func _update_hallucinations(delta: float) -> void:
	hallucination_timer -= delta
	if erosion > 42.0 and hallucination_timer <= 0.0:
		hallucination_timer = rng.randf_range(3.2, 6.8) - clampf(erosion / 100.0, 0.0, 0.9) * 2.0
		hallucinations.append({
			"position": _spawn_point_away_from_player(240.0, 520.0),
			"radius": 16.0,
			"speed": rng.randf_range(95.0, 145.0),
			"life": rng.randf_range(7.0, 12.0),
			"cooldown": 1.0,
		})

	for illusion in hallucinations.duplicate():
		illusion["life"] -= delta
		illusion["cooldown"] -= delta
		var direction = (player.global_position - illusion["position"]).normalized()
		illusion["position"] += direction * float(illusion["speed"]) * delta
		if player.global_position.distance_to(illusion["position"]) < player.radius + float(illusion["radius"]) + 4.0 and illusion["cooldown"] <= 0.0:
			illusion["cooldown"] = 1.25
			erosion = clampf(erosion + player.receive_damage(5.5, 0.6), 0.0, 100.0)
		if illusion["life"] <= 0.0:
			hallucinations.erase(illusion)

func _start_extraction() -> void:
	extraction_active = true
	extraction_time = 60.0
	extraction_spawn_timer = 0.1
	state = "extracting"
	erosion = clampf(erosion + 8.0, 0.0, 100.0)

func _open_mutation_choices() -> void:
	state = "mutation"
	player.active = false
	for child in mutation_cards.get_children():
		child.queue_free()

	for mutation in MUTATION_DATA.pick_three():
		var button := Button.new()
		button.custom_minimum_size = Vector2(176.0, 210.0)
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.text = "%s\n%s / %s\n\n%s" % [
			mutation["name"],
			MUTATION_DATA.RARITY_LABELS[mutation["rarity"]],
			MUTATION_DATA.SLOT_LABELS[mutation["slot"]],
			mutation["desc"],
		]
		button.pressed.connect(_choose_mutation.bind(mutation))
		mutation_cards.add_child(button)

	mutation_panel.visible = true

func _choose_mutation(mutation: Dictionary) -> void:
	player.apply_mutation(mutation)
	erosion = clampf(erosion + (14.0 if mutation["rarity"] == "abyssal" else 7.0), 0.0, 100.0)
	player.active = true
	state = "extracting" if extraction_active else "playing"
	mutation_panel.visible = false
	_update_ui()

func _show_result(win: bool) -> void:
	if state == "game_over":
		return
	state = "game_over"
	player.active = false
	result_title.text = "撤离成功" if win else "实验体死亡"
	result_body.text = "带回 %d 份基因碎片，进化至 %d 级。" % [player.genes, player.level] if win else "本局携带的 %d 份基因碎片与器官全部丢失。" % player.genes
	result_panel.visible = true

func _update_camera() -> void:
	camera.global_position = player.global_position

func _update_ui() -> void:
	hud["hp_bar"].value = clampf(player.hp / player.max_hp * 100.0, 0.0, 100.0)
	hud["hp_text"].text = "%d/%d" % [maxi(0, int(round(player.hp))), int(round(player.max_hp))]
	hud["erosion_bar"].value = erosion
	hud["erosion_text"].text = "%d%%" % int(round(erosion))
	hud["xp_bar"].value = clampf(float(player.xp) / float(player.xp_need) * 100.0, 0.0, 100.0)
	hud["xp_text"].text = "%d/%d" % [player.xp, player.xp_need]
	hud["bag_text"].text = "胃袋 %d/%d    基因 %d" % [player.bag, player.bag_capacity, player.genes]

	var organ_texts := []
	for slot in MUTATION_DATA.SLOT_LABELS.keys():
		var organ = player.organs[slot]
		organ_texts.append("%s:%s" % [MUTATION_DATA.SLOT_LABELS[slot], organ["name"] if organ != null else "空"])
	hud["organs"].text = "  ".join(organ_texts)

	if extraction_active:
		hud["mission"].text = "撤离尸潮：%ds" % int(ceil(extraction_time))
	elif player.global_position.distance_to(EXIT_POSITION) <= EXIT_RADIUS + player.radius:
		hud["mission"].text = "净化电梯就绪：按 E 开始撤离"
	else:
		var distance_to_exit := int(round(player.global_position.distance_to(EXIT_POSITION)))
		hud["mission"].text = "目标：吞噬血肉并前往净化电梯  %dm" % distance_to_exit

	if message_timer > 0.0:
		hud["message"].text = "胃袋已满"
	else:
		hud["message"].text = ""

func _create_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(root)

	var top := VBoxContainer.new()
	top.position = Vector2(16.0, 16.0)
	top.custom_minimum_size = Vector2(610.0, 120.0)
	root.add_child(top)

	var title := Label.new()
	title.text = "深渊共生：蚀变"
	title.add_theme_font_size_override("font_size", 20)
	top.add_child(title)

	hud["hp_bar"] = _make_bar(top, "生命")
	hud["hp_text"] = _make_value(top, "100/100")
	hud["erosion_bar"] = _make_bar(top, "侵蚀")
	hud["erosion_text"] = _make_value(top, "0%")
	hud["xp_bar"] = _make_bar(top, "经验")
	hud["xp_text"] = _make_value(top, "0/60")

	hud["mission"] = Label.new()
	hud["mission"].position = Vector2(920.0, 24.0)
	hud["mission"].custom_minimum_size = Vector2(330.0, 60.0)
	hud["mission"].add_theme_font_size_override("font_size", 18)
	root.add_child(hud["mission"])

	hud["message"] = Label.new()
	hud["message"].position = Vector2(570.0, 650.0)
	hud["message"].add_theme_font_size_override("font_size", 22)
	root.add_child(hud["message"])

	hud["organs"] = Label.new()
	hud["organs"].position = Vector2(16.0, 650.0)
	hud["organs"].custom_minimum_size = Vector2(800.0, 40.0)
	root.add_child(hud["organs"])

	hud["bag_text"] = Label.new()
	hud["bag_text"].position = Vector2(1010.0, 650.0)
	hud["bag_text"].custom_minimum_size = Vector2(240.0, 40.0)
	root.add_child(hud["bag_text"])

	mutation_panel = PanelContainer.new()
	mutation_panel.position = Vector2(330.0, 145.0)
	mutation_panel.custom_minimum_size = Vector2(620.0, 340.0)
	mutation_panel.visible = false
	root.add_child(mutation_panel)

	var mutation_box := VBoxContainer.new()
	mutation_panel.add_child(mutation_box)
	var mutation_title := Label.new()
	mutation_title.text = "基因链失稳：选择一个器官移植"
	mutation_title.add_theme_font_size_override("font_size", 24)
	mutation_box.add_child(mutation_title)
	mutation_cards = HBoxContainer.new()
	mutation_box.add_child(mutation_cards)

	result_panel = PanelContainer.new()
	result_panel.position = Vector2(420.0, 210.0)
	result_panel.custom_minimum_size = Vector2(440.0, 250.0)
	result_panel.visible = false
	root.add_child(result_panel)

	var result_box := VBoxContainer.new()
	result_panel.add_child(result_box)
	result_title = Label.new()
	result_title.add_theme_font_size_override("font_size", 28)
	result_box.add_child(result_title)
	result_body = Label.new()
	result_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	result_box.add_child(result_body)
	var restart := Button.new()
	restart.text = "再次进入深渊"
	restart.pressed.connect(_new_run)
	result_box.add_child(restart)

func _make_bar(parent: VBoxContainer, label_text: String) -> ProgressBar:
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(560.0, 22.0)
	parent.add_child(row)
	var label := Label.new()
	label.text = label_text
	label.custom_minimum_size = Vector2(42.0, 22.0)
	row.add_child(label)
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(410.0, 18.0)
	bar.show_percentage = false
	row.add_child(bar)
	return bar

func _make_value(parent: VBoxContainer, text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.visible = false
	parent.add_child(label)
	return label

func _draw_floor() -> void:
	draw_rect(Rect2(Vector2.ZERO, WORLD_SIZE), Color(0.02, 0.027, 0.024))

	for x in range(0, int(WORLD_SIZE.x), 80):
		draw_line(Vector2(x, 0), Vector2(x, WORLD_SIZE.y), Color(0.84, 1.0, 0.29, 0.045), 1.0)
	for y in range(0, int(WORLD_SIZE.y), 80):
		draw_line(Vector2(0, y), Vector2(WORLD_SIZE.x, y), Color(0.84, 1.0, 0.29, 0.045), 1.0)

	for y in range(220, int(WORLD_SIZE.y), 420):
		draw_rect(Rect2(Vector2(80.0, float(y)), Vector2(WORLD_SIZE.x - 160.0, 118.0)), Color(0.93, 0.96, 0.90, 0.025), true)
	for x in range(320, int(WORLD_SIZE.x), 560):
		draw_rect(Rect2(Vector2(float(x), 80.0), Vector2(112.0, WORLD_SIZE.y - 160.0)), Color(0.93, 0.96, 0.90, 0.025), true)

	for patch in patches:
		var color := Color(0.46, 1.0, 0.58, 0.10)
		if patch["tone"] == "red":
			color = Color(1.0, 0.29, 0.33, 0.10)
		elif patch["tone"] == "amber":
			color = Color(0.84, 1.0, 0.29, 0.10)
		draw_circle(patch["position"], patch["radius"], color)

	for prop in props:
		var rect := Rect2(-prop["size"] * 0.5, prop["size"])
		draw_set_transform(prop["position"], prop["rotation"], Vector2.ONE)
		draw_rect(rect, Color(0.93, 0.96, 0.90, 0.08), true)
		draw_rect(rect, Color(0.93, 0.96, 0.90, 0.13), false, 1.0)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	draw_rect(Rect2(Vector2(12.0, 12.0), WORLD_SIZE - Vector2(24.0, 24.0)), Color(1.0, 0.29, 0.33, 0.36), false, 5.0)

func _draw_exit() -> void:
	draw_circle(EXIT_POSITION, EXIT_RADIUS + sin(Time.get_ticks_msec() * 0.004) * 8.0, Color(0.84, 1.0, 0.29, 0.09))
	draw_arc(EXIT_POSITION, EXIT_RADIUS, 0.0, TAU, 96, Color(1.0, 0.29, 0.33) if extraction_active else Color(0.84, 1.0, 0.29), 3.0)
	draw_rect(Rect2(EXIT_POSITION - Vector2(44.0, 30.0), Vector2(88.0, 60.0)), Color(0.93, 0.96, 0.90, 0.12), true)

func _draw_puddles() -> void:
	for puddle in puddles:
		var alpha := clampf(float(puddle["life"]) / 3.2, 0.0, 1.0)
		draw_circle(puddle["position"], puddle["radius"], Color(0.84, 1.0, 0.29, 0.14 * alpha))

func _draw_hallucinations() -> void:
	for illusion in hallucinations:
		var alpha := 0.45 if player != null and player.has_trait("abyss_crown") else 0.28
		draw_circle(illusion["position"], illusion["radius"], Color(0.76, 0.54, 1.0, alpha))
		draw_arc(illusion["position"], illusion["radius"], 0.0, TAU, 24, Color(0.76, 0.54, 1.0, alpha + 0.12), 2.0)

func _draw_slashes() -> void:
	for slash in slashes:
		var alpha := clampf(float(slash["life"]) / float(slash["max_life"]), 0.0, 1.0)
		draw_arc(slash["position"], slash["radius"], slash["angle"] - 0.65, slash["angle"] + 0.65, 18, Color(1.0, 0.29, 0.33, alpha), 12.0)

func _spawn_point_away_from_player(min_distance := 620.0, max_distance := 1100.0) -> Vector2:
	var angle := rng.randf_range(0.0, TAU)
	var distance := rng.randf_range(min_distance, max_distance)
	return (player.global_position + Vector2.RIGHT.rotated(angle) * distance).clamp(Vector2(60.0, 60.0), WORLD_SIZE - Vector2(60.0, 60.0))

func _spawn_point_near_exit() -> Vector2:
	var angle := rng.randf_range(0.0, TAU)
	var distance := rng.randf_range(180.0, 520.0)
	return (EXIT_POSITION + Vector2.RIGHT.rotated(angle) * distance).clamp(Vector2(40.0, 40.0), WORLD_SIZE - Vector2(40.0, 40.0))

func _random_offset(max_distance: float) -> Vector2:
	return Vector2.RIGHT.rotated(rng.randf_range(0.0, TAU)) * rng.randf_range(0.0, max_distance)

func _pick(items: Array) -> Variant:
	return items[rng.randi_range(0, items.size() - 1)]

func _angle_distance(a: float, b: float) -> float:
	return absf(wrapf(a - b, -PI, PI))
