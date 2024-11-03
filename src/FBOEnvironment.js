import {
    Group,
    WebGLCubeRenderTarget,
    CubeCamera,
    HalfFloatType,
    Object3D
} from "three";

const DefaultFBOLayer = 1

export default class FBOEnvironment {
    /**
     * 环境贴图（离屏渲染）
     * @param  {...Object3D} object 
     */
    constructor(...object) {
        this.renderTarget = new WebGLCubeRenderTarget(256)
        this.renderTarget.texture.type = HalfFloatType
        this.rtCubeCamera = new CubeCamera(1, 1000, this.renderTarget)
        this.texture = this.renderTarget.texture

        this.group = new Group()
        this.group.name = 'FBOEnvironment'
        this.group.add(...object)

        this.setEnvObjectsVisible(false)
    }
    setLayer(layer) {
        this.rtCubeCamera.layers.set(layer)
        this.group.traverse(child => {
            child.layers.set(layer)
        })
    }
    setEnvObjectsVisible(visible) {
        if (visible) {
            this.rtCubeCamera.layers.set(DefaultFBOLayer)
            this.group.traverse(child => {
                child.layers.enableAll()
            })
        } else {
            this.setLayer(DefaultFBOLayer)
        }
    }
    update(renderer, scene) {
        this.rtCubeCamera.update(renderer, scene)
    }
}