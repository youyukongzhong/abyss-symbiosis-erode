extends Node2D
class_name Projectile

var velocity := Vector2.ZERO
var radius := 4.0
var damage := 10.0
var life := 1.4
var pierce := 0
var poison := false
var from_enemy := false
var color := Color(0.49, 0.97, 1.0)

func setup(origin: Vector2, direction: Vector2, payload: Dictionary, enemy_projectile := false) -> void:
	global_position = origin
	velocity = direction.normalized() * float(payload.get("speed", 520.0))
	damage = float(payload.get("damage", 10.0))
	radius = float(payload.get("radius", 4.0))
	pierce = int(payload.get("pierce", 0))
	poison = bool(payload.get("poison", false))
	from_enemy = enemy_projectile
	color = payload.get("color", Color(0.49, 0.97, 1.0))

func _process(delta: float) -> void:
	global_position += velocity * delta
	life -= delta
	queue_redraw()
	if life <= 0.0:
		queue_free()

func _draw() -> void:
	draw_circle(Vector2.ZERO, radius, color)
