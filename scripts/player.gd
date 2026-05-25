extends CharacterBody2D
class_name Player

signal fired(origin: Vector2, direction: Vector2, payload: Dictionary)
signal slash(origin: Vector2, angle: float, radius: float, damage: float)

var active := true
var aim_position := Vector2.RIGHT
var radius := 18.0
var hp := 100.0
var max_hp := 100.0
var move_speed := 208.0
var damage := 16.0
var fire_rate := 4.2
var bullet_speed := 560.0
var armor := 0.0
var pierce := 0
var crit_bonus := 0.0
var xp := 0
var xp_need := 60
var level := 1
var genes := 0
var bag := 0
var bag_capacity := 10
var current_erosion := 0.0

var fire_cooldown := 0.0
var slash_cooldown := 0.0
var dash_cooldown := 0.0
var dash_cooldown_max := 1.65
var dash_time := 0.0

var organs := {
	"head": null,
	"torso": null,
	"left_arm": null,
	"right_arm": null,
	"legs": null,
}
var traits := {}

func _physics_process(delta: float) -> void:
	if not active:
		velocity = Vector2.ZERO
		return

	fire_cooldown = maxf(0.0, fire_cooldown - delta)
	slash_cooldown = maxf(0.0, slash_cooldown - delta)
	dash_cooldown = maxf(0.0, dash_cooldown - delta)
	dash_time = maxf(0.0, dash_time - delta)

	var direction := Vector2.ZERO
	if Input.is_key_pressed(KEY_W):
		direction.y -= 1.0
	if Input.is_key_pressed(KEY_S):
		direction.y += 1.0
	if Input.is_key_pressed(KEY_A):
		direction.x -= 1.0
	if Input.is_key_pressed(KEY_D):
		direction.x += 1.0
	if direction.length() > 0.0:
		direction = direction.normalized()

	if Input.is_key_pressed(KEY_SHIFT) and dash_cooldown <= 0.0 and direction.length() > 0.0:
		dash_time = 0.14
		dash_cooldown = dash_cooldown_max

	var load_ratio := clampf(float(bag) / float(maxi(1, bag_capacity)), 0.0, 1.0)
	var bag_slow := lerpf(1.0, 0.74, load_ratio)
	var dash_boost := 2.55 if dash_time > 0.0 else 1.0
	velocity = direction * move_speed * bag_slow * dash_boost
	move_and_slide()

	var aim_direction := aim_position - global_position
	if aim_direction.length() > 2.0:
		rotation = lerp_angle(rotation, aim_direction.angle(), 0.35)

	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_attack()

	if has_trait("regenerative_heart") and hp < max_hp:
		hp = minf(max_hp, hp + delta * 1.4)

	queue_redraw()

func has_trait(id: String) -> bool:
	return traits.has(id) and bool(traits[id])

func damage_multiplier() -> float:
	var scale := 0.017 if has_trait("abyss_crown") else 0.012
	return 1.0 + current_erosion * scale

func receive_damage(amount: float, erosion_gain := 1.0) -> float:
	var reduced := amount * (1.0 - clampf(armor, 0.0, 0.55))
	hp -= reduced
	return erosion_gain

func gain_xp(amount: int) -> bool:
	xp += amount
	if xp >= xp_need:
		xp -= xp_need
		xp_need = int(round(float(xp_need) * 1.34 + 18.0))
		level += 1
		return true
	return false

func apply_mutation(mutation: Dictionary) -> void:
	organs[mutation["slot"]] = mutation

	match mutation["id"]:
		"regenerative_heart":
			max_hp += 35.0
			hp = minf(max_hp, hp + 45.0)
			traits["regenerative_heart"] = true
		"mantis_blade":
			damage += 4.0
			traits["mantis_blade"] = true
		"spider_legs":
			move_speed += 44.0
			dash_cooldown_max = maxf(0.85, dash_cooldown_max - 0.45)
			traits["spider_legs"] = true
		"compound_eyes":
			pierce += 1
			crit_bonus += 0.45
			traits["compound_eyes"] = true
		"venom_gland":
			damage += 2.0
			traits["venom_gland"] = true
		"chitin_shell":
			max_hp += 28.0
			hp += 28.0
			armor += 0.18
			move_speed -= 14.0
			traits["chitin_shell"] = true
		"hunger_maw":
			bag_capacity += 4
			traits["hunger_maw"] = true
		"bone_launcher":
			fire_rate += 1.2
			bullet_speed += 120.0
			damage += 3.0
			traits["bone_launcher"] = true
		"abyss_crown":
			damage += 6.0
			crit_bonus += 0.25
			traits["abyss_crown"] = true

	queue_redraw()

func _attack() -> void:
	var direction := Vector2.RIGHT.rotated(rotation)
	if fire_cooldown <= 0.0:
		fire_cooldown = 1.0 / fire_rate
		var payload := {
			"damage": damage * damage_multiplier(),
			"speed": bullet_speed,
			"radius": 4.0,
			"pierce": pierce,
			"poison": has_trait("venom_gland"),
			"color": Color(0.84, 1.0, 0.29) if has_trait("venom_gland") else Color(0.49, 0.97, 1.0),
		}
		fired.emit(global_position + direction * 24.0, direction, payload)

	if has_trait("mantis_blade") and slash_cooldown <= 0.0:
		slash_cooldown = 0.42
		slash.emit(global_position, rotation, 86.0, damage * damage_multiplier() * 2.1)

func _draw() -> void:
	if has_trait("spider_legs"):
		for i in range(-2, 3):
			draw_line(Vector2(-4.0, i * 7.0), Vector2(-24.0, i * 13.0), Color(0.46, 1.0, 0.58, 0.75), 3.0)

	var body_color := Color(0.64, 1.0, 0.55) if has_trait("chitin_shell") else Color(0.46, 1.0, 0.58)
	draw_circle(Vector2.ZERO, radius, body_color)
	draw_circle(Vector2(radius * 0.42, -6.0), 4.0, Color(0.02, 0.03, 0.02))
	draw_circle(Vector2(radius * 0.42, 6.0), 4.0, Color(0.02, 0.03, 0.02))

	if has_trait("compound_eyes"):
		for i in range(-2, 3):
			draw_circle(Vector2(radius * 0.15, i * 4.0), 2.0, Color(0.49, 0.97, 1.0))

	if has_trait("mantis_blade"):
		draw_line(Vector2(3.0, -radius * 0.9), Vector2(56.0, -28.0), Color(1.0, 0.29, 0.33), 5.0)

	if has_trait("venom_gland"):
		draw_circle(Vector2(9.0, radius * 0.82), 6.0, Color(0.84, 1.0, 0.29))

	if has_trait("abyss_crown"):
		draw_arc(Vector2.ZERO, radius + 8.0, -0.8, 0.8, 24, Color(1.0, 0.82, 0.4), 2.0)
