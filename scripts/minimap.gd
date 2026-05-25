extends Control

var world_size := Vector2(3200.0, 2200.0)
var player_ref
var enemies_ref: Array = []
var loot_ref: Array = []
var exit_position := Vector2.ZERO
var exit_radius := 94.0

func setup(size: Vector2, player_node, enemy_nodes: Array, loot_nodes: Array, exit_pos: Vector2, radius: float) -> void:
	world_size = size
	player_ref = player_node
	enemies_ref = enemy_nodes
	loot_ref = loot_nodes
	exit_position = exit_pos
	exit_radius = radius
	queue_redraw()

func _draw() -> void:
	var rect := Rect2(Vector2.ZERO, size)
	draw_rect(rect, Color(0.02, 0.03, 0.025, 0.78), true)
	draw_rect(rect, Color(0.84, 1.0, 0.29, 0.26), false, 1.0)

	var scale := Vector2(size.x / world_size.x, size.y / world_size.y)
	var exit_pos := exit_position * scale
	draw_circle(exit_pos, maxf(3.0, exit_radius * scale.x), Color(0.84, 1.0, 0.29, 0.5))

	for item in loot_ref:
		if is_instance_valid(item):
			var p: Vector2 = item.global_position * scale
			draw_circle(p, 1.4, Color(1.0, 0.82, 0.4, 0.75))

	for enemy in enemies_ref:
		if is_instance_valid(enemy):
			var p: Vector2 = enemy.global_position * scale
			draw_circle(p, 2.0, Color(1.0, 0.29, 0.33, 0.85))

	if is_instance_valid(player_ref):
		var player_pos: Vector2 = player_ref.global_position * scale
		draw_circle(player_pos, 3.4, Color(0.46, 1.0, 0.58, 1.0))
