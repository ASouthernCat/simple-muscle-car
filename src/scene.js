import * as THREE from 'three';
import { gui } from './system/gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { sizes, initSizes } from './system/sizes';
import { initResizeEventListener } from './system/resize';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer, RenderPass } from 'postprocessing';
// import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { initEffect } from './effect';
import { initCar } from './car';
import VolumetricSpotlight from './VolumetricSpotlight';
import gsap from 'gsap';
import FBOEnvironment from './FBOEnvironment';
import isMobileDevice from './utils/deviceType';

async function initScene() {
    console.log('initScene');

    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    const sceneFolder = gui.addFolder('scene');
    sceneFolder.close();

    const canvas = document.getElementById('webgl');
    initSizes(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#25292d')
    scene.fog = new THREE.Fog('#25292d', 10, 20)
    // const envMapUrl = '/royal_esplanade_1k.hdr' // 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/royal_esplanade_1k.hdr'
    // const bgTexture = new RGBELoader().load(envMapUrl, (texture) => {
    //     texture.mapping = THREE.EquirectangularReflectionMapping;
    // })
    // scene.environment = bgTexture;
    // scene.environmentIntensity = 0.1;
    sceneFolder.addColor({background: scene.background.getHexString()}, 'background').onChange((value) => {
        scene.background = new THREE.Color(value)
    })

    const defaultViewPosion = new THREE.Vector3(-4.47, 3.77, -6.47);
    const camera = new THREE.PerspectiveCamera(55, sizes.width / sizes.height, 1, 100);
    camera.position.set(defaultViewPosion.x, defaultViewPosion.y, defaultViewPosion.z);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.target.set(0, 0.5, 0);
    controls.maxPolarAngle = Math.PI / 2 - Math.PI / 36;
    controls.screenSpacePanning = false;
    controls.enablePan = false;
    controls.maxDistance = 19.5
    controls.minDistance = 3.8;
    controls.zoomSpeed = 2;
    controls.rotateSpeed = 1.5;
    sceneFolder.add(controls, 'autoRotate')

    const lightFolder = sceneFolder.addFolder('light')
    lightFolder.close()
    let fboEnvironment = null
    initEnvLight()

    const renderer = new THREE.WebGLRenderer({
        canvas,
        powerPreference: "high-performance",
        antialias: false,
    })
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false; // 关闭阴影自动更新
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // postprocessing
    const composer = new EffectComposer(renderer, {
        multisampling: 0
    })
    // renderpass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    // effect
    initEffect(composer, camera)

    /** 场景要素 */
    // 地面
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshPhongMaterial({
            color: 0x202937,
        })
    )
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane)
    sceneFolder.addColor({ color: plane.material.color.getHexString() }, 'color').name('planeColor').onChange((value) => {
        plane.material.color = new THREE.Color(value)
    })
    // 车
    const { carScene, mixer, animationAction } = await initCar(scene)
    // 聚光灯（体积光）
    const spotlightGroup = new THREE.Group();
    const volumeSpotlight = new VolumetricSpotlight({intensity: 0, color: 0xdfdfb3},{useDepth: false});
    volumeSpotlight.position.set(-0.75, 0, -1.85);
    volumeSpotlight.target.position.set(-0.75, 0, -3.34);
    const volumeSpotlight2 = new VolumetricSpotlight({intensity: 0,color: 0xdfdfb3,},{useDepth: false});
    volumeSpotlight2.position.set(0.75, 0, -1.85);
    volumeSpotlight2.target.position.set(0.75, 0, -3.34);
    spotlightGroup.add(volumeSpotlight, volumeSpotlight.target, volumeSpotlight2, volumeSpotlight2.target);
    spotlightGroup.position.set(0,-0.18,-0.2);
    carScene.getObjectByName('车身').add(spotlightGroup);
    gui.add(spotlightGroup, 'visible').name('丁达尔光').listen()

    if(isMobileDevice()){
        spotlightGroup.visible = false
        scene.getObjectByName('reflectorMesh').visible = false
    }

    initResizeEventListener([camera], [renderer, composer]);

    const clock = new THREE.Clock();
    let delta = 0;
    const render = (t) => {
        delta = clock.getDelta();

        stats.update();

        mixer.update(delta);
        if (animationAction && animationAction.isRunning()) {
            renderer.shadowMap.needsUpdate = true;
        }else {
            renderer.shadowMap.autoUpdate = false;
        }

        volumeSpotlight.update()
        volumeSpotlight2.update()

        fboEnvironment && fboEnvironment.update(renderer, scene)
        
        controls.update();
        
        // renderer.render(scene, camera);
        composer.render(delta);

        requestAnimationFrame(render);
    }

    /**
     * 初始化环境灯光
     */
    function initEnvLight() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambientLight);
        const drLight = new THREE.DirectionalLight(0xffffee, 3);
        drLight.position.set(3.96, 2.6, -0.5);
        drLight.shadow.bias = -0.0006;
        scene.add(drLight);
        drLight.castShadow = true;

        lightFolder.add(ambientLight, 'intensity').name('ambientIntensity')
        lightFolder.add(drLight, 'intensity').name('DRLightIntensity')
        lightFolder.add(drLight, 'castShadow')
        lightFolder.add(drLight.shadow, 'bias').step(0.0001).name('DRLightBias')

        // 移动设备使用fbo环境光
        if(isMobileDevice()){
            // drLight.shadow.mapSize.set(128, 128)
            setFBOEnv()
            alert('实时渲染 | 移动端采用FBO模拟灯光效果，建议使用PC端浏览器预览')
            gui.close()
        } else {
            setNormalLight()
        }
    }

    function setFBOEnv(){
        const circle = new THREE.Mesh(
            new THREE.CircleGeometry(2, 32), 
            new THREE.MeshStandardMaterial({ emissive: 0xffffcc,emissiveIntensity: 1.5, side: THREE.DoubleSide })
        );
        circle.position.set(-3.4, 0.9, 0.8);
        circle.rotation.x = Math.PI / 2;
        circle.lookAt(0, 0, 0);
        const circle2 = new THREE.Mesh(
            new THREE.CircleGeometry(2, 32), 
            new THREE.MeshStandardMaterial({ emissive: 0xfff9bd,emissiveIntensity: 1.5, side: THREE.DoubleSide })
        );
        circle2.position.set(2, 2.3, 3.6);
        circle2.rotation.x = Math.PI / 2;
        circle2.lookAt(0, 0, 0);
    
        const fboEnv = new FBOEnvironment(circle , circle2)
        fboEnv.setEnvObjectsVisible(false)
        scene.environment = fboEnv.texture
        scene.add(fboEnv.group)
        fboEnvironment = fboEnv
    
        const fboFolder = gui.addFolder('FBO')
        fboFolder.close()
        fboFolder.add({fboEnvVisible: false}, 'fboEnvVisible').onChange((value) => {
            fboEnv.setEnvObjectsVisible(value)
        })
        fboFolder.add(circle.position, 'x').step(0.1).name('circleX')
        fboFolder.add(circle.position, 'y').step(0.1).name('circleY')
        fboFolder.add(circle.position, 'z').step(0.1).name('circleZ')
        fboFolder.add(circle.material, 'emissiveIntensity')
        fboFolder.addColor(circle.material, 'emissive').name('circleColor')
        fboFolder.add(circle2.position, 'x').step(0.1).name('circle2X')
        fboFolder.add(circle2.position, 'y').step(0.1).name('circle2Y')
        fboFolder.add(circle2.position, 'z').step(0.1).name('circle2Z')
        fboFolder.add(circle2.material, 'emissiveIntensity')
        fboFolder.addColor(circle2.material, 'emissive').name('circle2Color')
        fboFolder.add({ lookAt: ()=> {
            circle.lookAt(0, 0, 0)
            circle2.lookAt(0, 0, 0)
        }}, 'lookAt')
    }

    function setNormalLight(){
        const pointLight = new THREE.PointLight(0xffffc2, 260, 20);
        pointLight.position.set(-4, 4.8, 1.6);
        pointLight.castShadow = true;
        pointLight.shadow.bias = -0.0064
        pointLight.shadow.mapSize.set(2048, 2048)
        scene.add(pointLight);
        const pointLight2 = new THREE.PointLight(0x86fefc, 150, 20, 4);
        pointLight2.position.set(3.45, 2.6, 4.5);
        pointLight2.castShadow = true;
        pointLight2.shadow.bias = -0.004
        scene.add(pointLight2);

        lightFolder.add(pointLight.shadow, 'bias').step(0.0001).name('pointLightBias')
        lightFolder.add(pointLight2.shadow, 'bias').step(0.0001).name('pointLight2Bias')
        lightFolder.add(pointLight.position, 'x').step(0.01).name('pointLightX')
        lightFolder.add(pointLight.position, 'y').step(0.01).name('pointLightY')
        lightFolder.add(pointLight.position, 'z').step(0.01).name('pointLightZ')
        lightFolder.add(pointLight, 'intensity').min(0).max(1000).step(1).name('pointLightIntensity')
        lightFolder.addColor({ color: pointLight.color.getHexString() }, 'color').onChange((value) => {
            pointLight.color = new THREE.Color(value)
        }).name('pointLightColor')
    }

    /**
     * 阴影更新
     * @param {boolean} single 是否只更新一次，默认：false
     */
    function autoUpdateShadowSingle(single = false) {
        if (!single) {
            renderer.shadowMap.autoUpdate = true;
        }
        else {
            renderer.shadowMap.autoUpdate = false;
            renderer.shadowMap.needsUpdate = true;
        }
    }

    const timeline = gsap.timeline();
    /**
     * 入场动画
     */
    function cameraInTween() {
        gsap.killTweensOf(camera.position);
        timeline.delay(0.5)
        timeline.fromTo(camera.position, 
            { x: 0.03, y: 20, z: 4 },
            { x: -6.9, y: 11, z: 0, duration: 1.5, ease: 'power2.in',
                onStart: () => {
                    carScene.userData.fontLightMaterial.emissiveIntensity = 2;
                    document.querySelector(".loader-container").classList.add("loaded")
                }
             },
            0
        )
        .to(camera.position,
            { x: -5.4, y: 2.36, z: -5.52, duration: 1.5, ease: 'power2.out'},
            1.3
        )
        .to(camera.position,
            { x: defaultViewPosion.x, y: defaultViewPosion.y, z: defaultViewPosion.z, duration: 2, ease: "back.out(4)"},
            '>'
        ).fromTo(carScene.userData.fontLightMaterial, 
            { emissiveIntensity: 0 },
            { duration: 0.1, emissiveIntensity: 2, ease: 'power2.in', repeat: 6, yoyo: true}, 
            '<+=1.2'
        ).eventCallback("onComplete",()=> {
            const space = document.querySelector('.space')
            addEventListener('keydown', (e) => {
                if(e.key === ' ' || e.code === 'Space'){
                    animationEvent()
                }
            })
            space.addEventListener('click', animationEvent)
            function animationEvent(){
                if(animationAction && !animationAction.isRunning()){
                    console.log('play')
                    animationAction.stop()
                    animationAction.play()
                    space.classList.add('space-active')
                }
            }
            gui.open()
        })
    }

    render();
    autoUpdateShadowSingle(true);
    cameraInTween();

}

export { initScene };
