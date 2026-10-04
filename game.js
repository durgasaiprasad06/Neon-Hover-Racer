// ----------------------------------------------------
// 1. SETUP & SCENE
// ----------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02000a);
scene.fog = new THREE.FogExp2(0x02000a, 0.004); // Slightly denser fog for better depth

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadows
document.body.appendChild(renderer.domElement);

// ----------------------------------------------------
// 2. LIGHTING
// ----------------------------------------------------
const ambientLight = new THREE.AmbientLight(0x222244, 1.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xff00aa, 1.5);
dirLight.position.set(-50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
scene.add(dirLight);
scene.add(dirLight.target);

// ----------------------------------------------------
// 3. ENVIRONMENT
// ----------------------------------------------------
// Infinite Grid
const gridHelper = new THREE.GridHelper(2000, 100, 0xff00ff, 0x00ffff);
gridHelper.position.y = 0;
scene.add(gridHelper);

// Track Boundaries (Neon Pillars)
const boundaryGeo = new THREE.BoxGeometry(1, 10, 400);
const boundaryMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x0055aa, wireframe: true });
const leftBoundary = new THREE.Mesh(boundaryGeo, boundaryMat);
leftBoundary.position.set(-45, 5, 0);
scene.add(leftBoundary);
const rightBoundary = new THREE.Mesh(boundaryGeo, boundaryMat);
rightBoundary.position.set(45, 5, 0);
scene.add(rightBoundary);

// Stars Background
const starGeo = new THREE.BufferGeometry();
const starCount = 3000;
const starPos = new Float32Array(starCount * 3);
for(let i=0; i < starCount * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 1500;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.8 });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ----------------------------------------------------
// 4. VEHICLE
// ----------------------------------------------------
const vehicleGroup = new THREE.Group();
scene.add(vehicleGroup);

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.9, roughness: 0.1 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaff });

// Main chassis
const chassisGeo = new THREE.BoxGeometry(4, 1, 8);
const body = new THREE.Mesh(chassisGeo, bodyMat);
body.castShadow = true;
vehicleGroup.add(body);

// Cockpit
const cockpitGeo = new THREE.BoxGeometry(2.5, 1.2, 3.5);
const cockpit = new THREE.Mesh(cockpitGeo, new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.0 }));
cockpit.position.set(0, 0.8, -0.5);
vehicleGroup.add(cockpit);

// Spoiler
const spoilerGeo = new THREE.BoxGeometry(4.5, 0.2, 1);
const spoiler = new THREE.Mesh(spoilerGeo, bodyMat);
spoiler.position.set(0, 1.5, 3.5);
vehicleGroup.add(spoiler);

const strutGeo = new THREE.BoxGeometry(0.2, 1, 0.5);
const strutL = new THREE.Mesh(strutGeo, bodyMat);
strutL.position.set(-1.5, 1, 3.5);
vehicleGroup.add(strutL);
const strutR = new THREE.Mesh(strutGeo, bodyMat);
strutR.position.set(1.5, 1, 3.5);
vehicleGroup.add(strutR);

// Hover pads
const padGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16);
padGeo.rotateZ(Math.PI / 2);
const padPositions = [
    [-2.2, -0.2, -2.5], [2.2, -0.2, -2.5], 
    [-2.2, -0.2, 2.5], [2.2, -0.2, 2.5]
];
padPositions.forEach(pos => {
    const pad = new THREE.Mesh(padGeo, accentMat);
    pad.position.set(...pos);
    vehicleGroup.add(pad);
});

const engineLight = new THREE.PointLight(0x00aaff, 3, 25);
engineLight.position.set(0, 0, 3);
vehicleGroup.add(engineLight);
vehicleGroup.position.y = 5;

// ----------------------------------------------------
// 5. PARTICLES (Object Pool)
// ----------------------------------------------------
const particleCount = 150;
const particles = [];
const particleGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const particleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, blending: THREE.AdditiveBlending });

for (let i = 0; i < particleCount; i++) {
    const p = new THREE.Mesh(particleGeo, particleMat);
    p.visible = false;
    scene.add(p);
    particles.push({ mesh: p, life: 0, maxLife: 20 + Math.random() * 10 });
}
let particleIndex = 0;

// ----------------------------------------------------
// 6. OBSTACLES (Optimized Geometries)
// ----------------------------------------------------
const obstacles = [];
// REUSE Geometries & Materials to prevent memory leaks!
const obsGeo = new THREE.BoxGeometry(1, 2, 1);
const obsRingGeo = new THREE.TorusGeometry(1.5, 0.15, 8, 24);
const obstacleMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0x550022 });
const ringMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.8, wireframe: true });

function spawnObstacle(startZ = null) {
    if (state.gameOver) return;
    const size = Math.random() * 5 + 3;
    
    const obsGroup = new THREE.Group();
    
    const core = new THREE.Mesh(obsGeo, obstacleMat);
    core.scale.set(size, size, size);
    core.castShadow = true;
    obsGroup.add(core);

    const ring = new THREE.Mesh(obsRingGeo, ringMat);
    ring.scale.set(size, size, size);
    ring.rotation.x = Math.PI / 2;
    obsGroup.add(ring);
    
    const zPos = startZ !== null ? startZ : vehicleGroup.position.z - 300 - Math.random() * 200;
    
    obsGroup.position.set(
        (Math.random() - 0.5) * 80,
        size,
        zPos
    );
    
    scene.add(obsGroup);
    obstacles.push({ mesh: obsGroup, core: core, ring: ring, box: new THREE.Box3() });
}

// ----------------------------------------------------
// 7. GAME STATE & INPUT
// ----------------------------------------------------
const state = {
    velocity: new THREE.Vector3(),
    rotation: 0,
    maxSpeed: 100,
    acceleration: 45,
    friction: 0.92,
    hoverHeight: 2,
    score: 0,
    gameOver: false,
    baseSpeed: 0
};

const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });

// UI Elements
const scoreEl = document.getElementById('score-display');
const speedEl = document.getElementById('speed-display');
const gameOverEl = document.getElementById('game-over');
document.getElementById('restart-btn').addEventListener('click', restart);

function restart() {
    state.gameOver = false;
    state.score = 0;
    state.velocity.set(0,0,0);
    state.rotation = 0;
    state.baseSpeed = 0;
    
    vehicleGroup.position.set(0, 5, 0);
    vehicleGroup.rotation.set(0, 0, 0);
    
    // Cleanup old obstacles
    obstacles.forEach(o => scene.remove(o.mesh));
    obstacles.length = 0;
    
    gameOverEl.style.display = 'none';
    
    // Pre-warm obstacles
    for(let i=0; i<12; i++) {
        spawnObstacle(-300 - (i * 80) - Math.random()*50);
    }
}

// Initialize first set of obstacles
for(let i=0; i<12; i++) {
    spawnObstacle(-300 - (i * 80) - Math.random()*50);
}

// ----------------------------------------------------
// 8. ANIMATION LOOP
// ----------------------------------------------------
const clock = new THREE.Clock();
const vehicleBox = new THREE.Box3();
const idealCameraOffset = new THREE.Vector3(0, 7, 18);
const idealLookAt = new THREE.Vector3(0, 0, -10);

function animate() {
    requestAnimationFrame(animate);
    // Cap delta time to prevent physics glitches during lag spikes
    const dt = Math.min(clock.getDelta(), 0.1); 

    if (!state.gameOver) {
        // Input handling
        let moveZ = 0;
        let moveX = 0;
        if (keys.w) moveZ -= 1;
        if (keys.s) moveZ += 1;
        if (keys.a) moveX -= 1;
        if (keys.d) moveX += 1;

        // Difficulty increase (base speed goes up)
        state.baseSpeed += dt * 2.5;
        const currentMaxSpeed = state.maxSpeed + state.baseSpeed;

        // Physics update
        const acc = new THREE.Vector3(moveX, 0, moveZ).normalize().multiplyScalar(state.acceleration * dt);
        state.velocity.add(acc);
        state.velocity.multiplyScalar(state.friction);
        
        // Cap manual speed
        if (state.velocity.length() > currentMaxSpeed * dt) {
            state.velocity.setLength(currentMaxSpeed * dt);
        }

        // Automatic forward momentum (runner style)
        state.velocity.z -= (15 + state.baseSpeed) * dt;

        // Apply velocity
        vehicleGroup.position.add(state.velocity);
        
        // Banking (Roll)
        const targetRoll = -moveX * Math.PI / 4;
        vehicleGroup.rotation.z += (targetRoll - vehicleGroup.rotation.z) * (dt * 5);
        
        // Hover smoothing
        vehicleGroup.position.y += (state.hoverHeight - vehicleGroup.position.y) * (dt * 5);

        // Enforce track boundaries (Hard limits to prevent escaping)
        const trackLimit = 42;
        if (vehicleGroup.position.x > trackLimit) {
            vehicleGroup.position.x = trackLimit;
            state.velocity.x = 0;
        } else if (vehicleGroup.position.x < -trackLimit) {
            vehicleGroup.position.x = -trackLimit;
            state.velocity.x = 0;
        }

        // Move grid and boundaries with player (Infinite illusion)
        const zOffset = vehicleGroup.position.z;
        gridHelper.position.z = zOffset - (zOffset % 100);
        leftBoundary.position.z = zOffset;
        rightBoundary.position.z = zOffset;
        stars.position.z = zOffset - (zOffset % 500);

        // Move light to prevent the world from going pitch black
        dirLight.position.z = zOffset + 50;
        dirLight.target.position.set(0, 0, zOffset);

        // Update obstacles & Collisions
        vehicleBox.setFromObject(body);
        // Shrink hitbox slightly to make it fair
        vehicleBox.expandByScalar(-0.2); 
        
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.ring.rotation.z += dt * 2; // Animate neon ring
            obs.box.setFromObject(obs.core);
            
            // Collision Check
            if (vehicleBox.intersectsBox(obs.box)) {
                state.gameOver = true;
                gameOverEl.style.display = 'flex';
            }

            // Remove passed obstacles and spawn new ones ahead
            if (obs.mesh.position.z > vehicleGroup.position.z + 50) {
                scene.remove(obs.mesh);
                obstacles.splice(i, 1);
                spawnObstacle();
                state.score += 10;
            }
        }

        // Update UI
        scoreEl.innerText = `SCORE: ${Math.floor(state.score + Math.abs(vehicleGroup.position.z)/10)}`;
        speedEl.innerText = `SPEED: ${Math.floor(Math.abs(state.velocity.z) * 60)} KM/H`;

        // Handle Particles
        if (keys.w) {
            const p = particles[particleIndex];
            p.mesh.position.copy(vehicleGroup.position);
            p.mesh.position.z += 3.5;
            p.mesh.position.x += (Math.random() - 0.5) * 1.5; // Spread
            p.life = p.maxLife;
            p.mesh.visible = true;
            particleIndex = (particleIndex + 1) % particleCount;
        }
    }

    // Update visible particles
    particles.forEach(p => {
        if (p.life > 0) {
            p.life -= dt * 60; // Normalize decay to framerate
            p.mesh.position.z += dt * 10;
            p.mesh.scale.setScalar(Math.max(0.01, p.life / p.maxLife));
            p.mesh.material.opacity = p.life / p.maxLife;
            if (p.life <= 0) p.mesh.visible = false;
        }
    });

    // Camera follow logic
    const targetCamPos = vehicleGroup.position.clone().add(idealCameraOffset);
    
    // Screen shake at high speeds
    const speedFactor = Math.abs(state.velocity.z);
    if (!state.gameOver && speedFactor > 0.5) {
        const shake = (speedFactor - 0.5) * 0.15;
        targetCamPos.x += (Math.random() - 0.5) * shake;
        targetCamPos.y += (Math.random() - 0.5) * shake;
    }

    // Lerp camera for smooth tracking
    const lerpSpeed = state.gameOver ? 0.05 : 0.1;
    camera.position.lerp(targetCamPos, lerpSpeed);
    
    const targetLookAt = vehicleGroup.position.clone().add(idealLookAt);
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    currentLookAt.add(camera.position);
    currentLookAt.lerp(targetLookAt, lerpSpeed);
    camera.lookAt(currentLookAt);

    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start
animate();
