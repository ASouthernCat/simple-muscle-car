import {
    EffectComposer,
    EffectPass,
    SMAAEffect,
    ShaderPass,
    VignetteEffect,
    BloomEffect,
    BlendFunction,
    SMAAPreset,
    HueSaturationEffect,
    NoiseEffect
} from 'postprocessing';
// import { FilmShader } from 'three/examples/jsm/shaders/FilmShader.js';
// import { ShaderMaterial } from 'three';
import { gui } from './system/gui';

/**
 * 
 * @param {EffectComposer} composer 
 * @param {*} camera 
 */
function initEffect(composer, camera) {
    // film pass
    // const filmShaderMaterial = new ShaderMaterial({
    //     uniforms: {
    //         time: { value: 0 },
    //         intensity: { value: 0.8 },
    //         grayscale: { value: false }
    //     },
    //     vertexShader: FilmShader.vertexShader,
    //     fragmentShader: FilmShader.fragmentShader
    // })
    // filmShaderMaterial.onBeforeRender = () => {
    //     filmShaderMaterial.uniforms.time.value += 0.01
    //     filmShaderMaterial.uniforms.time.value %= 1
    // }
    // const filmPass = new ShaderPass( filmShaderMaterial )

    // smaa
    const smaaEffect = new SMAAEffect({
        preset: SMAAPreset.MEDIUM,
    });
    const smaaPass = new EffectPass(camera, smaaEffect);
    // bloom
    const bloomEffect = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        mipmapBlur: true,
        luminanceSmoothing: 0.4,
        luminanceThreshold: 0.35,
        intensity: 4,
        radius: 0.85
    })
    const bloomPass = new EffectPass(camera, bloomEffect);
    
    // vignette
    const vignetteEffect = new VignetteEffect({
        offset: 0.35,
        darkness: 0.65
    })
    const vignettePass = new EffectPass(camera, vignetteEffect);
    // hue saturation
    const hueSaturationEffect = new HueSaturationEffect({
        hue: 0,
        saturation: 0.2
    })
    const hueSaturationPass = new EffectPass(camera, hueSaturationEffect)
    // noise
    const noiseEffect = new NoiseEffect({
        premultiply: true,
    })
    const noisePass = new EffectPass(camera, noiseEffect)

    // add pass
    composer.addPass(smaaPass);
    composer.addPass(bloomPass);
    composer.addPass(vignettePass);
    composer.addPass(hueSaturationPass);
    composer.addPass(noisePass);
    // composer.addPass(filmPass); // 使用 noisePass 替代

    const effectFolder = gui.addFolder('postprocessing')
    effectFolder.close()
    effectFolder.add(bloomEffect, 'intensity').min(0).max(10).step(0.1).name('bloom intensity');
    effectFolder.add({ noisePass: true }, 'noisePass').onChange((value) => {
        const index = composer.passes.length
        if (value) {
            composer.addPass(noisePass, index)
        }else{
            composer.removePass(noisePass)
        }
    })
}

export { initEffect }