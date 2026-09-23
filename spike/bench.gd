extends SceneTree
func _init():
	for n in [100, 200, 400]:
		var seed := 12345
		var px := PackedFloat64Array(); var py := PackedFloat64Array(); var hp := PackedInt32Array(); var team := PackedInt32Array()
		px.resize(n); py.resize(n); hp.resize(n); team.resize(n)
		for i in n:
			seed = (seed * 1103515245 + 12345) % 2147483648
			px[i] = float(seed % 6400) / 100.0
			seed = (seed * 1103515245 + 12345) % 2147483648
			py[i] = float(seed % 6400) / 100.0
			hp[i] = 100; team[i] = i % 2
		var ticks := 600
		var t0 := Time.get_ticks_usec()
		for t in ticks:
			for i in n:
				if hp[i] <= 0: continue
				var best := -1; var bd := 1e18
				for j in n:
					if team[j] == team[i] or hp[j] <= 0: continue
					var dx := px[j]-px[i]; var dy := py[j]-py[i]; var d := dx*dx+dy*dy
					if d < bd: bd = d; best = j
				if best >= 0:
					if bd < 1.0: hp[best] -= 1
					else:
						var l := sqrt(bd); px[i] += (px[best]-px[i])/l*0.2; py[i] += (py[best]-py[i])/l*0.2
		var ms := (Time.get_ticks_usec()-t0)/1000.0/ticks
		print("godot n=%d ms/tick=%.3f" % [n, ms])
	quit()
