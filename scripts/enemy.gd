extends CharacterBody2D
class_name Enemy

signal died(enemy: Enemy)
signal shot(origin: Vector2, direction: Vector2, payload: Dictionary)
signal melee_hit(amount: float)

var enemy_type := "charger"
var elite := false
var hp := 40.0
var max_hp := 40.0
var move_speed := 120.0
var damage := 10.0
var xp_value := 16
var radius := 17.0
var attack_cooldown := 0.0
var weak_angle := 0.0
var weak_broken := false
var hit_flash := 0.0

func configure(kind: String, is_elite := false) -> void:
	enemy_type = kind
	elite = is_elite
	weak_angle = randf_range(0.0, TAU)
	attack_cooldown = randf_range(0.2, 1.4)

	if enemy_type == "charger":
		max_hp = 46.0
		move_speed = 134.0
		damage = 12.0
		xp_value = 18
		radius = 17.0
	elif enemy_type == "spitter":
		max_hp = 38.0
		move_speed = 92.0
		damage = 10.0
		xp_value = 20
		radius = 16.0
	else:
		max_hp = 52.0
		move_speed = 104.0
		damage = 9.0
		xp_value = 16
		radius = 15.0

	if elite:
		max_hp *= 1.65
		move_speed *= 1.12
		damage *= 1.35
		xp_value = int(round(float(xp_value) * 1.8))
		radius *= 1.22

	hp = max_hp
	queue_redraw()

func update_ai(target: Vector2, delta: float) -> void:
	attack_cooldown -= delta
	hit_flash = maxf(0.0, hit_flash - delta)

	var to_target := target - global_position
	var dist := maxf(to_target.length(), 1.0)
	var direction := to_target / dist
	rotation = lerp_angle(rotation, direction.angle(), 0.12)

	if enemy_type == "charger":
		velocity = direction * move_speed
		if dist < radius + 28.0 and attack_cooldown <= 0.0:
			attack_cooldown = 0.78
			melee_hit.emit(damage)
	elif enemy_type == "spitter":
		var desired := 0.0
		if dist > 280.0:
			desired = 1.0
		elif dist < 210.0:
			desired = -1.0
		velocity = direction * move_speed * desired
		if attack_cooldown <= 0.0 and dist < 720.0:
			attack_cooldown = 1.2 if elite else 1.75
			shot.emit(global_position + direction * (radius + 6.0), direction, {
				"damage": damage,
				"speed": 225.0,
				"radius": 5.0,
				"color": Color(0.84, 1.0, 0.29),
			})
	else:
		var strafe := 1.0 if sin(Time.get_ticks_msec() * 0.002 + global_position.x) > 0.0 else -1.0
		var desired := 0.0
		if dist > 420.0:
			desired = 1.0
		elif dist < 300.0:
			desired = -0.8
		velocity = direction * move_speed * desired + direction.orthogonal() * move_speed * 0.45 * strafe
		if attack_cooldown <= 0.0 and dist < 820.0:
			attack_cooldown = 0.85 if elite else 1.25
			shot.emit(global_position + direction * (radius + 6.0), direction, {
				"damage": damage,
				"speed": 360.0,
				"radius": 4.0,
				"color": Color(1.0, 0.72, 0.66),
			})

	move_and_slide()
	queue_redraw()

func hurt(amount: float, crit := false) -> void:
	hp -= amount
	hit_flash = 0.09
	if crit:
		weak_broken = true
	if hp <= 0.0:
		died.emit(self)
	queue_redraw()

func weakpoint_global() -> Vector2:
	return global_position + Vector2.RIGHT.rotated(weak_angle) * radius * 0.62

func _draw() -> void:
	var body_color := Color(1.0, 0.29, 0.33)
	if enemy_type == "spitter":
		body_color = Color(0.84, 1.0, 0.29)
	elif enemy_type == "merc":
		body_color = Color(0.82, 0.84, 0.80)
	if hit_flash > 0.0:
		body_color = Color.WHITE

	if enemy_type == "merc":
		draw_rect(Rect2(Vector2(-radius, -radius * 0.75), Vector2(radius * 2.0, radius * 1.5)), body_color, true)
		draw_rect(Rect2(Vector2(radius * 0.15, -3.0), Vector2(radius * 1.35, 6.0)), Color(1.0, 0.72, 0.66), true)
	else:
		draw_circle(Vector2.ZERO, radius, body_color)
		draw_circle(Vector2(-radius * 0.2, -radius * 0.12), radius * 0.22, Color(0.02, 0.03, 0.02, 0.65))

	if not weak_broken and enemy_type != "merc":
		var local_weak := to_local(weakpoint_global())
		draw_circle(local_weak, radius * 0.24, Color(0.46, 1.0, 0.58))

	var hp_ratio := clampf(hp / max_hp, 0.0, 1.0)
	draw_rect(Rect2(Vector2(-radius, -radius - 13.0), Vector2(radius * 2.0, 4.0)), Color(0.0, 0.0, 0.0, 0.5), true)
	draw_rect(Rect2(Vector2(-radius, -radius - 13.0), Vector2(radius * 2.0 * hp_ratio, 4.0)), Color(1.0, 0.82, 0.4) if elite else Color(0.46, 1.0, 0.58), true)
