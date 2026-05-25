extends Node2D
class_name Loot

var kind := "gene"
var value := 1
var radius := 10.0
var pulse := 0.0
var collected := false

func setup(item_kind: String, amount: int) -> void:
	kind = item_kind
	value = amount
	radius = 13.0 if kind == "organ" else 10.0
	pulse = randf_range(0.0, TAU)

func _process(delta: float) -> void:
	pulse += delta * 5.0
	queue_redraw()

func _draw() -> void:
	var draw_color := Color(1.0, 0.82, 0.4)
	if kind == "flesh":
		draw_color = Color(0.49, 0.97, 1.0)
	elif kind == "syringe":
		draw_color = Color(0.46, 1.0, 0.58)
	elif kind == "organ":
		draw_color = Color(0.76, 0.54, 1.0)

	var bob := sin(pulse) * 2.5
	if kind == "syringe":
		draw_rect(Rect2(Vector2(-12, -4 + bob), Vector2(24, 8)), draw_color, true)
	else:
		draw_circle(Vector2(0, bob), radius, draw_color)
		draw_circle(Vector2(3, -2 + bob), radius * 0.34, Color(0.02, 0.03, 0.02, 0.55))
