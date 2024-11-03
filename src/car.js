import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Reflector, ReflectorMaterial } from '@alienkitty/alien.js/three';
import { sizes } from './system/sizes';
import { gui } from './system/gui';

const dracoLoader = new DRACOLoader();
const draco_path = '/draco/';
dracoLoader.setDecoderPath(draco_path);
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader)

const modelUrl = "/car_draco.glb"
const animations = []

/**
 * 加载模型
 * @param {string} url 
 * @returns {Promise<THREE.Group>}
 */
function loadModel(url) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(url, (gltf) => {
            const model = gltf.scene;
            if( gltf.animations.length > 0) {
                animations.push(...gltf.animations)
            }
            resolve(model)
        }, undefined, reject)
    })
}

/**
 * 
 * @param {THREE.Scene} scene 
 */
async function initCar(scene) {
    const car = await loadModel(modelUrl)
    console.log(car)
    scene.add(car)

    const carFolder = gui.addFolder('car')
    const materialParams = {
        carColor: '#FF6D00',
        hubColor: '#81FF00',
        ringColor: '#ffe37f',
    }
    carFolder.addColor(materialParams, 'carColor').onChange(updateMaterials)
    carFolder.addColor(materialParams, 'hubColor').onChange(updateMaterials)
    carFolder.addColor(materialParams, 'ringColor').onChange(updateMaterials)
    
    updateMaterials()

    // 反射地面
    addReflectorFloor()

    // 动画
    const mixer = new THREE.AnimationMixer(car)
    let animationAction = null
    if( animations.length > 0) {
        const animationsClip = animations[0]
        animationAction = mixer.clipAction(animationsClip)
        animationAction.loop = THREE.LoopOnce
        console.log(animationAction)
        // animationAction.play()
    }

    function updateMaterials() {
        car.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true

                if (child.material.name == '车漆') {
                    child.material.color = new THREE.Color(materialParams.carColor)
                }
                if (child.material.name == '环') {
                    child.material.color = new THREE.Color(materialParams.hubColor)
                }
                if (child.material.name == '发光') {
                    car.userData.fontLightMaterial = child.material
                }
                if (child.material.name == '发光环') {
                    child.material.emissive = new THREE.Color(materialParams.ringColor)
                    child.material.emissiveIntensity = 0.95
                }
                if (child.material.name == '车牌') {
                    child.material.emissiveIntensity = 0.3
                }
            }
        })

    }

    function addReflectorFloor() {
        // 反射材质
        const reflector = new Reflector({ blurIterations: 8 })
        reflector.setSize(sizes.width, sizes.height)
        const reflectorMaterial = new ReflectorMaterial({
            reflectivity: 0.5,
            color: new THREE.Color('#444440'),
            fog: scene.fog,
            mirror: 1,
            mixStrength: 4,
            dithering: true,
        })
        reflectorMaterial.uniforms.tReflect = reflector.renderTargetUniform
        reflectorMaterial.uniforms.uMatrix = reflector.textureMatrixUniform
        // 反射地面
        const reflectorGeometry = new THREE.CircleGeometry(3.35, 128)
        const reflectorMesh = new THREE.Mesh(reflectorGeometry, reflectorMaterial)
        reflectorMesh.name = 'reflectorMesh'
        reflectorMesh.add(reflector)
        reflectorMesh.position.set(0, 0.37, 0.193)
        reflectorMesh.rotation.x = -Math.PI / 2
        reflectorMesh.onBeforeRender = (renderer, scene, camera) => {
            reflectorMesh.visible = false
            reflector.update(renderer, scene, camera)
            reflectorMesh.visible = true
        }
        scene.add(reflectorMesh)
        carFolder.add(reflectorMesh, 'visible').name('反射圆盘').listen()
    }

    return {
        carScene: car,
        mixer,
        animationAction
    }
}

export { initCar };