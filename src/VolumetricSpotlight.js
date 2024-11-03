import {
    DepthTexture,
    Mesh,
    SpotLight,
    CylinderGeometry,
    UnsignedShortType,
    Vector2,
    WebGLRenderTarget,
    DepthFormat,
    HalfFloatType,
    LinearFilter,
    Vector3,
    Color,
} from 'three';
import { SpotLightMaterial } from '@pmndrs/vanilla';

const worldPosition = new Vector3();
const rendererSize = new Vector2();
let orignBackground = null;

const _spotlightOptions = {
    /** default: 0xffffff */
    color: 0xffffff,
    /** default: 100 */
    intensity: 100,
    /** default: 10 */
    distance: 10,
    /** default: Math.PI / 6 */
    angle: Math.PI / 6,
    /** 聚光锥的半影衰减百分比。默认值为 0 */
    penumbra: 0,
    /** 沿着光照距离的衰减量。默认值为 2 */
    decay: 2
}
const _volumeParams = {
    radiusTop: 0.1,
    useDepth: true,
    depthResolution: 1024,
}

export default class VolumetricSpotlight extends SpotLight {

    static instance = null;

    /**
     * VolumetricSpotlight
     * @param {{color: string, intensity: number, distance: number, angle: boolean, penumbra: number, decay: number}} spotlightOptions 
     * @param {{radiusTop: number, useDepth: boolean, depthResolution: number}} volumeParams
     */
    constructor(
        spotlightOptions = _spotlightOptions,
        volumeParams = _volumeParams,
    ) {
        const spotlightParams = Object.assign({ ..._spotlightOptions }, spotlightOptions);
        super(spotlightParams.color, spotlightParams.intensity, spotlightParams.distance, spotlightParams.angle, spotlightParams.penumbra, spotlightParams.decay);
        
        VolumetricSpotlight.instance = this;

        this.volumeParams = Object.assign({ ..._volumeParams }, volumeParams);
        
        this.renderer = null;
        this.scene = null;
        this.camera = null;

        this.volumeMaterial = new SpotLightMaterial();
        this.volumeMaterial.attenuation = this.distance;
        this.volumeMaterial.lightColor = this.color;
        this.volumeMaterial.anglePower = 6;

        this.volumeMesh = new Mesh();
        this.volumeMesh.castShadow = false;
        this.volumeMesh.receiveShadow = false;
        this.volumeMesh.material = this.volumeMaterial;
        this.updateVolumeGeometry();
        this.add(this.volumeMesh);
        this.volumeMesh.lookAt(this.target.getWorldPosition(worldPosition));

        this.depthTexture = null;
        this.depthTarget = null;

        this.volumeMesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
            if(this.renderer != renderer || this.scene != scene || this.camera != camera) {
                this.renderer = renderer;
                this.scene = scene;
                this.camera = camera;
                this.updateVolumeMaterial();
                this.updateDepthTargets();
            }
        }
    }

    updateVolumeMaterial() {
        this.volumeMaterial.attenuation = this.distance;
        this.volumeMaterial.lightColor = this.color;
        this.volumeMaterial.cameraFar = this.camera.far;
        this.volumeMaterial.cameraNear = this.camera.near;
    }

    updateVolumeGeometry() {
        const distance = this.distance;
        const radiusBottom = Math.tan(this.angle) * this.distance;
        const radiusTop = this.volumeParams.radiusTop;

        const geometry = new CylinderGeometry(radiusTop, radiusBottom, distance, 128, 64, true);
        geometry.translate(0, -distance / 2, 0);
        geometry.rotateX(-Math.PI / 2);

        if (this.volumeMesh.geometry) {
            this.volumeMesh.geometry.dispose();
        }
        this.volumeMesh.geometry = geometry;
    }

    updateDepthTargets() {
        if(!this.renderer) return;
        this.renderer.getSize(rendererSize);
        rendererSize.multiplyScalar(this.renderer.getPixelRatio());

        if (this.depthTexture) {
            this.depthTexture.dispose();
        }
        this.depthTexture = new DepthTexture(this.volumeParams.depthResolution, this.volumeParams.depthResolution);
        this.depthTexture.format = DepthFormat;
        this.depthTexture.type = UnsignedShortType;
        this.depthTexture.name = 'Depth_Buffer';

        if (this.depthTarget) {
            this.depthTarget.dispose();
        }
        this.depthTarget = new WebGLRenderTarget(this.volumeParams.depthResolution, this.volumeParams.depthResolution, {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            type: HalfFloatType,
            samples: 0,
            depthTexture: this.depthTexture
        })

        if (this.volumeParams.useDepth) {
            this.volumeMaterial.depth = this.depthTexture;
            this.depthOnResize();
            window.addEventListener('resize', this.depthOnResize);
        } else {
            this.volumeMaterial.depth = null;
            this.volumeMaterial.resolution.set(0, 0);
            window.removeEventListener('resize', this.depthOnResize);
        }
    }

    renderDepth() {
        if(!this.renderer || !this.scene || !this.camera) return;
        if(orignBackground != this.scene.background){
            orignBackground = this.scene.background;
        }        
        this.volumeMaterial.depth = null;
        this.renderer.setRenderTarget(this.depthTarget);
        this.scene.background = new Color('#000'); // clear background
        this.renderer.render(this.scene, this.camera);
        if(orignBackground?.isColor){
            this.scene.background.set(orignBackground);
        }
        if(orignBackground?.isTexture){
            this.scene.background = orignBackground;
        }
        this.renderer.setRenderTarget(null);
        this.volumeMaterial.depth = this.depthTexture;
    }

    depthOnResize() {
        const that = VolumetricSpotlight.instance;
        that.renderer.getSize(rendererSize);
        rendererSize.multiplyScalar(that.renderer.getPixelRatio());
        that.volumeMaterial.resolution.copy(that.renderer.getSize(rendererSize));
    }

    update() {
        this.volumeMaterial.lightColor = this.color;
        this.volumeMaterial.spotPosition.copy(this.volumeMesh.getWorldPosition(worldPosition));
        this.volumeMesh.castShadow = false;
        this.volumeMesh.lookAt(this.target.getWorldPosition(worldPosition));
        if (this.volumeParams.useDepth) {
            this.renderDepth();
        }
    }
}

