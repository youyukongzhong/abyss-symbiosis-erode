extends RefCounted
class_name MutationData

const SLOT_LABELS := {
	"head": "头部",
	"torso": "躯干",
	"left_arm": "左臂",
	"right_arm": "右臂",
	"legs": "双腿",
}

const RARITY_LABELS := {
	"common": "普通",
	"rare": "稀有",
	"epic": "史诗",
	"abyssal": "深渊",
}

const RARITY_WEIGHTS := {
	"common": 60,
	"rare": 25,
	"epic": 12,
	"abyssal": 3,
}

static func all() -> Array:
	return [
		{
			"id": "regenerative_heart",
			"name": "再生心核",
			"slot": "torso",
			"rarity": "common",
			"desc": "生命上限提高，移植时立刻恢复生命。",
		},
		{
			"id": "mantis_blade",
			"name": "螳螂刃",
			"slot": "left_arm",
			"rarity": "common",
			"desc": "左臂变成近战骨刃，射击时追加扇形斩击。",
		},
		{
			"id": "spider_legs",
			"name": "蛛行腿",
			"slot": "legs",
			"rarity": "common",
			"desc": "移动速度提高，冲刺冷却缩短。",
		},
		{
			"id": "compound_eyes",
			"name": "复眼簇",
			"slot": "head",
			"rarity": "rare",
			"desc": "子弹可穿透一个目标，弱点伤害提高。",
		},
		{
			"id": "venom_gland",
			"name": "腐毒腺",
			"slot": "right_arm",
			"rarity": "rare",
			"desc": "弹体命中后留下腐蚀毒池。",
		},
		{
			"id": "chitin_shell",
			"name": "几丁甲壳",
			"slot": "torso",
			"rarity": "rare",
			"desc": "获得伤害减免和生命，但略微降低速度。",
		},
		{
			"id": "hunger_maw",
			"name": "饥饿胃袋",
			"slot": "torso",
			"rarity": "epic",
			"desc": "胃袋容量提高，拾取基因物质时回复少量生命。",
		},
		{
			"id": "bone_launcher",
			"name": "骨刺发射器",
			"slot": "right_arm",
			"rarity": "epic",
			"desc": "射速、弹速和基础伤害提高。",
		},
		{
			"id": "abyss_crown",
			"name": "深渊冠冕",
			"slot": "head",
			"rarity": "abyssal",
			"desc": "侵蚀提供更高伤害收益，幻觉更容易识别。",
		},
	]

static func pick_three() -> Array:
	var result: Array = []
	var source := all()
	var guard := 0
	while result.size() < 3 and guard < 80:
		guard += 1
		var picked := _weighted_pick(source)
		if not _contains_id(result, picked["id"]):
			result.append(picked)
	return result

static func _weighted_pick(source: Array) -> Dictionary:
	var total := 0
	for item in source:
		total += RARITY_WEIGHTS[item["rarity"]]

	var roll := randi_range(1, total)
	for item in source:
		roll -= RARITY_WEIGHTS[item["rarity"]]
		if roll <= 0:
			return item.duplicate(true)
	return source[0].duplicate(true)

static func _contains_id(items: Array, id: String) -> bool:
	for item in items:
		if item["id"] == id:
			return true
	return false
