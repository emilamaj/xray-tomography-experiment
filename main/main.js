
//import * as THREE from '../build/three.min.js';//for production
import * as THREE from '../build/three.module.js';
import {OrbitControls} from './jsm/controls/OrbitControls.js';
//import {TeapotBufferGeometry} from './jsm/geometries/TeapotBufferGeometry.js';

let scanCamera, scanScene, scanRenderer, scanCameraControls;
let sliceCamera, sliceScene, sliceRenderer, sliceCameraControls;
let catCamera, catScene, catRenderer, catCameraControls;
let ambientLight, light;
let scanCanvasWidth, scanCanvasHeight;
let sliceCanvasWidth, sliceCanvasHeight;
let catCanvasWidth, catCanvasHeight;
let teapotMaterial,ringMaterial,planeMaterial,emitterMaterial,detectorMaterial,beamMaterial,knotMaterial;
let textureCube;
let planeMesh, refMesh, mainModel, meshTeapot, meshRing, meshEmitter, meshBeam, meshPlane, meshDetector, meshKnot;//Various meshes used
let scanHeight, scanRadius, thetaDiv, vertDiv, beamDivergence, numDet;//scanning parameters
let slicePos;//Position of the slice, as a ratio of scanHeight
let refData;//Reference slice, it is the goal of the reconstruction to produce it.
let sliceData;//Holds the raw data of the scan to be fed to the reconstruction algorithm
let sliceDimension;//Dimension of the reconstruction 2D grid (cell resolution)
let sliceGrid;//2D grid containing the intensities of the reconstructed points
let sandwichRef, sandwichPile;//Array containing pile of slices (both reference and reconstructed)
let modelAbsorptionFactor;//Absorption factor, I=I0*exp(-k*L)
let isScanInitOk = false;
let isSliceInitOk = false;
let rebuildScan = true;//Flag to be set for rebuilding the scan model view scene
let floorVal, clipCircle;//Intensity cut-off floor, crop circle radius (in percent of slice size)

scanControlsSetup();
sliceControlsSetup();
catControlsSetup();
init();
requestAnimationFrame(renderScan);
renderScan();

function scanControlsSetup(){
    //Page input controls
    let scanHeightSlider = document.getElementById("scanHeightSlider");
    let scanRadiusSlider = document.getElementById("scanRadiusSlider");
    let angularDivSlider = document.getElementById("angularDivSlider");
    let verticalDivSlider = document.getElementById("verticalDivSlider");
    let beamDivSlider = document.getElementById("beamDivSlider");
    let numDetSlider = document.getElementById("numDetSlider");
    let modAbsSlider = document.getElementById("modAbsSlider");

    let scanHeightText = document.getElementById("scanHeightText");
    let scanRadiusText = document.getElementById("scanRadiusText");
    let angularDivText = document.getElementById("angularDivText");
    let verticalDivText = document.getElementById("verticalDivText");
    let beamDivText = document.getElementById("beamDivText");
    let numDetText = document.getElementById("numDetText");
    let modAbsText = document.getElementById("modAbsText");
    
    function updateScanText(){
        scanHeightText.innerHTML = scanHeightSlider.value/100;
        scanHeight = scanHeightSlider.value/100; 

        scanRadiusText.innerHTML = scanRadiusSlider.value/100;
        scanRadius = scanRadiusSlider.value/100;

        angularDivText.innerHTML = angularDivSlider.value;
        thetaDiv = angularDivSlider.value;

        verticalDivText.innerHTML = verticalDivSlider.value;
        vertDiv = verticalDivSlider.value;

        beamDivText.innerHTML = beamDivSlider.value;
        beamDivergence = beamDivSlider.value * Math.PI / 180;//In Radians

        numDetText.innerHTML = numDetSlider.value;
        numDet = numDetSlider.value;

        modAbsText.innerHTML = modAbsSlider.value/10;
        modelAbsorptionFactor = modAbsSlider.value/10;

        rebuildScan = true;
        if (isScanInitOk){
            renderScan();
        }
    }
    updateScanText();
    scanHeightSlider.oninput = updateScanText;
    scanRadiusSlider.oninput = updateScanText;
    angularDivSlider.oninput = updateScanText;
    verticalDivSlider.oninput = updateScanText;
    beamDivSlider.oninput = updateScanText;
    numDetSlider.oninput = updateScanText;
    modAbsSlider.oninput = updateScanText;
}
function sliceControlsSetup(){
    let slicePosSlider = document.getElementById("slicePosSlider");
    let slicePosText = document.getElementById("slicePosText");
    let sliceDimSlider = document.getElementById("sliceDimSlider");
    let sliceDimText = document.getElementById("sliceDimText");
    let sliceButton = document.getElementById("sliceButton");
    let sliceFloorSlider = document.getElementById("sliceFloorSlider");
    let sliceFloorText = document.getElementById("sliceFloorText");
    let sliceClipSlider = document.getElementById("sliceClipSlider");
    let sliceClipText = document.getElementById("sliceClipText");
    let sliceFilterButton = document.getElementById("sliceFilterButton");

    function updateSliceText(){
        //Divide by 10 to give 0.1% resolution
        slicePosText.innerHTML = slicePosSlider.value/10;
        slicePos = slicePosSlider.value / 1000;
        sliceDimText.innerHTML = 2 ** sliceDimSlider.value;
        sliceDimension = 2 ** sliceDimSlider.value;
        sliceFloorText.innerHTML = sliceFloorSlider.value/100
        floorVal = sliceFloorSlider.value/100
        sliceClipText.innerHTML = sliceClipSlider.value/100
        clipCircle = sliceClipSlider.value/100

        if(isScanInitOk){
            rebuildScan = true;
            renderScan();
        }
        if(isSliceInitOk){
            renderSlice();
        }
    }

    updateSliceText();
    slicePosSlider.oninput = updateSliceText;
    sliceDimSlider.oninput = updateSliceText;
    sliceFloorSlider.oninput = updateSliceText
    sliceClipSlider.oninput = updateSliceText
    sliceButton.onclick = function(){sliceCompute();processSlice();}
    sliceClipSlider.oninput = function(){updateSliceText();processSlice();}
    sliceFloorSlider.oninput = function(){updateSliceText();processSlice();}
    sliceFilterButton.onclick = function(){updateSliceText();processSlice();}
}
function catControlsSetup(){

}

function canvasUpdateSize(){
    scanCanvasWidth = window.innerWidth / 3;
    scanCanvasHeight = window.innerHeight / 1.5;
    sliceCanvasWidth = window.innerWidth / 3;
    sliceCanvasHeight = window.innerHeight / 1.5;
    catCanvasWidth = window.innerWidth / 3;
    catCanvasHeight = window.innerHeight / 1.5;
}
function onWindowResize() {
    canvasUpdateSize();

    scanRenderer.setSize( scanCanvasWidth, scanCanvasHeight );
    scanCamera.aspect = scanCanvasWidth / scanCanvasHeight;
    scanCamera.updateProjectionMatrix();

    sliceRenderer.setSize( sliceCanvasWidth, sliceCanvasHeight );
    sliceCamera.aspect = sliceCanvasWidth / sliceCanvasHeight;
    sliceCamera.updateProjectionMatrix();

    catRenderer.setSize( catCanvasWidth, catCanvasHeight );
    catCamera.aspect = catCanvasWidth / catCanvasHeight;
    catCamera.updateProjectionMatrix();

    renderScan();
    renderSlice();
    renderCat();
}

function init() {
    canvasUpdateSize();
    // RENDERER
    scanRenderer = new THREE.WebGLRenderer({antialias: false});
    scanRenderer.setPixelRatio( window.devicePixelRatio );
    scanRenderer.setSize( scanCanvasWidth, scanCanvasHeight );
    scanRenderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById("scanViewer").appendChild(scanRenderer.domElement)

    sliceRenderer = new THREE.WebGLRenderer({antialias: false});
    sliceRenderer.setPixelRatio( window.devicePixelRatio );
    sliceRenderer.setSize( sliceCanvasWidth, sliceCanvasHeight );
    sliceRenderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById("sliceViewer").appendChild(sliceRenderer.domElement)

    catRenderer = new THREE.WebGLRenderer({antialias: false});
    catRenderer.setPixelRatio( window.devicePixelRatio );
    catRenderer.setSize( catCanvasWidth, catCanvasHeight );
    catRenderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById("catViewer").appendChild(catRenderer.domElement)

    // EVENTS
    window.addEventListener('resize', onWindowResize, false);

    // CAMERA
    //scan
    scanCamera = new THREE.PerspectiveCamera(45, scanCanvasWidth / scanCanvasHeight, 0.05, 1000);
    scanCamera.position.set(0, 0, 5);
    scanCamera.lookAt(new THREE.Vector3(0,0,0));
    //slice
    sliceCamera = new THREE.PerspectiveCamera(45, sliceCanvasWidth / sliceCanvasHeight, 0.05, 1000);
    sliceCamera.position.set(0, 0, 5);
    sliceCamera.lookAt(new THREE.Vector3(0,0,0));
    //cat
    catCamera = new THREE.PerspectiveCamera(45, catCanvasWidth / catCanvasHeight, 0.05, 1000);
    catCamera.position.set(0, 0, 3);
    catCamera.lookAt(new THREE.Vector3(0,0,0));
    // CONTROLS
    scanCameraControls = new OrbitControls( scanCamera, scanRenderer.domElement );
    scanCameraControls.addEventListener( 'change', renderScan );

    sliceCameraControls = new OrbitControls( sliceCamera, sliceRenderer.domElement );
    sliceCameraControls.addEventListener( 'change', renderSlice );

    // scene itself
    scanScene = new THREE.Scene();
    sliceScene = new THREE.Scene();
    catScene = new THREE.Scene();

    // LIGHTS
    ambientLight = new THREE.AmbientLight( 0x333333 );	// 0.2
    light = new THREE.DirectionalLight( 0xFFFFFF, 1.0 );
    ambientLight.color.setHSL(0.1, 0.7, 0.9 );//HSL: hue, saturation, lightness
    light.position.set(0.3, 0.3, 0.7);//Light "direction"
    light.color.setHSL(0.1, 0.01, 0.25);
    scanScene.add(light);
    sliceScene.add(ambientLight);
    //SKY CUBE
    const path = "textures/cube/pisa/";
    const urls = [
        path + "px.png", path + "nx.png",
        path + "py.png", path + "ny.png",
        path + "pz.png", path + "nz.png"
    ];
    textureCube = new THREE.CubeTextureLoader().load(urls, dummy => rebuildScan = true);
    textureCube.encoding = THREE.sRGBEncoding;
    scanScene.background = textureCube;
    sliceScene.background = textureCube;
    //FLOOR GRID
    const helper = new THREE.GridHelper( 10, 10 );
    helper.position.y = 0;
    helper.material.opacity = 0.6;
    helper.material.transparent = true;
    scanScene.add( helper );

    // MATERIALS
    const teapotColor = new THREE.Color("hsl(0.1, 50%, 60%)");
    const specularColor = new THREE.Color("rgb(220, 220, 220)");
    const greyColor = new THREE.Color("rgb(200, 200, 200)");
    const redColor = new THREE.Color("rgb(200, 10, 10)");
    const knotColor = new THREE.Color("rgb(200, 240, 10)");
    //teapotMaterial = new THREE.MeshPhongMaterial({ color: teapotColor, side: THREE.DoubleSide });
    //teapotMaterial.specular.copy(specularColor);
    ringMaterial = new THREE.MeshPhongMaterial({color: greyColor, side: THREE.DoubleSide });
    ringMaterial.specular.copy(greyColor);
    planeMaterial = new THREE.MeshPhongMaterial({color: greyColor, side:THREE.DoubleSide});
    planeMaterial.specular.copy(greyColor);
    emitterMaterial = new THREE.MeshPhongMaterial({color: greyColor, side:THREE.DoubleSide});
    emitterMaterial.specular.copy(greyColor);
    //detectorMaterial = new THREE.MeshPhongMaterial({color: greyColor, side:THREE.DoubleSide});
    //detectorMaterial.specular.copy(greyColor);
    beamMaterial = new THREE.MeshPhongMaterial({color: redColor, side:THREE.DoubleSide});
    beamMaterial.specular.copy(redColor);
    knotMaterial = new THREE.MeshPhongMaterial({color: knotColor, side:THREE.DoubleSide});
    knotMaterial.specular.copy(knotColor);
    
    //sliceCompute();
    //catCompute();
    scanSceneBuild();
    isScanInitOk = true;
}

function scanSceneBuild(){//Used to modify the scanScene without having to call init()
    //meshTeapot.geometry.dispose();
    //scene.remove(meshTeapot);
    //MESHES
    //teapot
    //const teapotGeometry = new TeapotBufferGeometry( 1, 15, true, true, true, false, false); //Teapotsize,Tessellation,bottom,lid,body,fitlid,BlinnVersion
    //meshTeapot = new THREE.Mesh(teapotGeometry, teapotMaterial);	
    //mainModel = meshTeapot;
    //ring
    let tubeRadius =  0.1;
    let radialSegments =  11;
    let tubularSegments =  24;
    const ringGeometry = new THREE.TorusBufferGeometry(scanRadius, tubeRadius, radialSegments, tubularSegments);
    meshRing = new THREE.Mesh(ringGeometry, ringMaterial)
    meshRing.rotation.x = - Math.PI / 2;
    meshRing.position.y = scanHeight*slicePos;
    scanScene.add(meshRing);
    //slice plane
    let segments = 24;
    const circleGeometry = new THREE.CircleBufferGeometry(scanRadius, segments);
    meshPlane = new THREE.Mesh(circleGeometry, planeMaterial)
    meshPlane.rotation.x = - Math.PI / 2;
    meshPlane.position.y = scanHeight * slicePos;
    meshPlane.material.transparent = true;
    meshPlane.material.opacity = 0.5;
    scanScene.add(meshPlane);
    //emitter
    let radius = 0.2;
    const widthSegments = 12;
    const heightSegments = 8;
    const emitterGeometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments);
    meshEmitter = new THREE.Mesh(emitterGeometry, emitterMaterial)
    meshEmitter.position.x = - scanRadius;
    meshEmitter.position.y = scanHeight * slicePos;
    scanScene.add(meshEmitter)
    //ray Beam
    /*
    segments = 24;
    const thetaStart = -beamDivergence / 2;
    const thetaLength = beamDivergence;
    const beamGeometry = new THREE.CircleBufferGeometry(scanRadius, segments, thetaStart, thetaLength);
    meshBeam = new THREE.Mesh(beamGeometry, beamMaterial)
    meshBeam.geometry.scale(2,1,1)//Stretch the "pie slice"
    meshBeam.rotation.x = - Math.PI / 2;
    meshBeam.position.x = - scanRadius;
    meshBeam.position.y = 0.001 + scanHeight * slicePos;	
    meshBeam.material.transparent = true;
    meshBeam.material.opacity = 0.5
    scanScene.add(meshBeam)
    */
    var geomBeam = new THREE.Geometry(); 
    segments = 24;
    let v1 = new THREE.Vector3(-scanRadius, 0.001 + scanHeight*slicePos, 0);
    let v2,v3;
    for(let i=0; i<segments; i++){
        v2 = new THREE.Vector3(scanRadius*Math.cos((i*beamDivergence/segments)-beamDivergence/2), 0.001 + scanHeight*slicePos, scanRadius*Math.sin((i*beamDivergence/segments)-beamDivergence/2));
        v3 = new THREE.Vector3(scanRadius*Math.cos(((i+1)*beamDivergence/segments)-beamDivergence/2), 0.001 + scanHeight*slicePos, scanRadius*Math.sin(((i+1)*beamDivergence/segments)-beamDivergence/2));
    
        geomBeam.vertices.push(v1.clone());
        geomBeam.vertices.push(v2.clone());
        geomBeam.vertices.push(v3.clone());
        geomBeam.faces.push(new THREE.Face3(3*i, 3*i + 1, 3*i + 2));
    }
    meshBeam = new THREE.Mesh(geomBeam, beamMaterial);
    meshBeam.material.transparent = true;
    meshBeam.material.opacity = 0.5
    scanScene.add(meshBeam);
    //detector
    //model not used yet
    //Main Model
    radius = 1;
    tubeRadius = 0.3;
    radialSegments = 8;
    tubularSegments = 64;
    const p = 2;
    const q = 3;
    //const knotGeometry = new THREE.TorusKnotBufferGeometry(radius, tubeRadius, tubularSegments, radialSegments, p, q);
    const knotGeometry = new THREE.TorusKnotGeometry(radius, tubeRadius, tubularSegments, radialSegments, p, q);
    meshKnot = new THREE.Mesh(knotGeometry, knotMaterial)
    meshKnot.rotation.x = - Math.PI / 2;
    mainModel = meshKnot
    scanScene.add(mainModel)
}

function processSlice(){//
    let refMesh = meshFromGrid(sliceDimension, refData, val=>val);
    refMesh.position.x = -0.5;
    sliceScene.add(refMesh)

    let processedSliceGrid = postProcess(sliceDimension, sliceGrid, floorVal, clipCircle)
    let planeMesh = meshFromGrid(sliceDimension, processedSliceGrid, val=>val);
    
    planeMesh.position.x = 0.5
    sliceScene.add(planeMesh);
    renderSlice();
}

function sliceCompute(){//Slice the model at the given height and compute reverse tomography slice
    refData=[];
    sliceData = [];//Stores the sinogram
    sliceGrid = [];
    let lineEmpty = [];
    for(let i = 0; i < sliceDimension; i++){
        lineEmpty.push(0);
    }
    for (let i=0; i<sliceDimension; i++){//Init with zeroes the 2d grid
        sliceGrid.push(lineEmpty.slice());
        refData.push(lineEmpty.slice());
    }

    let beamData = [];

    let rayDirection = new THREE.Vector3(1, 0, 0);
    let rayPoint = new THREE.Vector3(0, 0, 0);
    let intersects;
    let penetrationLength;

    let raycaster = new THREE.Raycaster(rayPoint, rayDirection);
    raycaster.far = 2 * scanRadius;
    
    //SIMULATE DATA ACQUISITION OF THE SCANNING
    rayPoint = new THREE.Vector3(-scanRadius, scanHeight*slicePos, 0);//Position of the emitter
    for (let epos = 0; epos < thetaDiv; epos++){//Iterate over emitter positions
        beamData = [];
        for (let d = 0; d < numDet; d++){//Iterate over detectors
            //Calculate the position of the current detector
            //The hemicircular geometry is taken into account
            rayDirection.x = scanRadius * Math.cos((-beamDivergence/2) + d*beamDivergence/numDet - epos*2*Math.PI/thetaDiv);	
            rayDirection.y = scanHeight*slicePos;
            rayDirection.z = scanRadius * Math.sin((-beamDivergence/2) + d*beamDivergence/numDet - epos*2*Math.PI/thetaDiv);
            rayDirection.sub(rayPoint);
            rayDirection.normalize();

            raycaster.set(rayPoint, rayDirection);
            //intersects = intersectObject(rayPoint, rayDirection, geom);
            intersects = raycaster.intersectObject(mainModel)
            penetrationLength = 0;
            if (intersects.length > 0){
                if (intersects.length%2 == 0){
                    //We have an even, non-zero number of intersections
                    for(let itsc=0; itsc<intersects.length/2;itsc++){
                        let point1 = intersects[2*itsc].point
                        let point2 = intersects[2*itsc+1].point

                        let x0 = Math.round((point1.x/scanRadius + 1)*sliceDimension/2)
                        let z0 = Math.round((point1.z/scanRadius + 1)*sliceDimension/2)
                        let x1 = Math.round((point2.x/scanRadius + 1)*sliceDimension/2)
                        let z1 = Math.round((point2.z/scanRadius + 1)*sliceDimension/2)
                        
                        x0 = Math.round(x0)
                        x0 = (x0 >= sliceDimension) ? sliceDimension -1 : x0
                        x0 = (x0 <= 0) ? 0 : x0
                        x1 = Math.round(x1)
                        x1 = (x1 >= sliceDimension) ? sliceDimension -1 : x1
                        x1 = (x1 <= 0) ? 0 : x1
                        z0 = Math.round(z0)
                        z0 = (z0 >= sliceDimension) ? sliceDimension -1 : z0
                        z0 = (z0 <= 0) ? 0 : z0
                        z1 = Math.round(z1)
                        z1 = (z1 >= sliceDimension) ? sliceDimension -1 : z1
                        z1 = (z1 <= 0) ? 0 : z1
                        drawLineBresenham(x0, z0, x1, z1, 1, refData)
                        //Using the distance property gives us the travalled distance inside the mesh
                        penetrationLength += (intersects[2*itsc+1].distance - intersects[2*itsc].distance);
                    }
                }else{
                    if(intersects.length==1){
                        //console.log("bad raycasting = 1")
                    }else{
                        //console.log("bad raycasting > 2")
                    }
                }
            }
            //Using an exponential law to simulate absorption by the material I=I0*exp(-k*L)
            beamData.push(Math.exp(-modelAbsorptionFactor*penetrationLength));
        }
        sliceData.push(beamData.slice());
        rayPoint.applyAxisAngle(new THREE.Vector3(0,1,0), 2 * Math.PI / thetaDiv);//Rotate the detector position
    }


    //RECONSTRUCTION OF THE SLICE
    
    let emitterPoint = new THREE.Vector3(-1, 0, 0);//Position of the emitter
    let detectorPoint = new THREE.Vector3(0, 0, 0);//Position of the detector
    let x0,z0,x1,z1;
    //using Xiaolin Wu's line algorithm
    //using Besenham's line algorithm (faster)
    for(let i=0; i < thetaDiv; i++){//Iterate over emitter positions
        for(let j=0; j < numDet; j++){
            detectorPoint.x =  Math.cos((-beamDivergence/2) + j*beamDivergence/numDet);
            detectorPoint.z =  Math.sin((-beamDivergence/2) + j*beamDivergence/numDet);
            detectorPoint.applyAxisAngle(new THREE.Vector3(0,1,0), i * 2 * Math.PI / thetaDiv);
            x0 = (emitterPoint.x + 1)*sliceDimension/2;
            z0 = (emitterPoint.z + 1)*sliceDimension/2;
            x1 = (detectorPoint.x + 1)*sliceDimension/2;
            z1 = (detectorPoint.z + 1)*sliceDimension/2;
            
            x0 = Math.round(x0)
            x0 = (x0 >= sliceDimension) ? sliceDimension -1 : x0
            x0 = (x0 <= 0) ? 0 : x0
            x1 = Math.round(x1)
            x1 = (x1 >= sliceDimension) ? sliceDimension -1 : x1
            x1 = (x1 <= 0) ? 0 : x1
            z0 = Math.round(z0)
            z0 = (z0 >= sliceDimension) ? sliceDimension -1 : z0
            z0 = (z0 <= 0) ? 0 : z0
            z1 = Math.round(z1)
            z1 = (z1 >= sliceDimension) ? sliceDimension -1 : z1
            z1 = (z1 <= 0) ? 0 : z1

            //Draws a "line" on sliceGrid like on a 2D pixel grid.
            drawLineBresenham(x0,z0,x1,z1,sliceData[i][j],sliceGrid);
        }
        emitterPoint.applyAxisAngle(new THREE.Vector3(0,1,0), 2 * Math.PI / thetaDiv);//Rotate the detector position
    }
    isSliceInitOk = true;
}
function catCompute(){

}

function renderScan() {
    //Apply transformations
    if(rebuildScan){
        if (isScanInitOk){
            //meshTeapot.geometry.dispose();
            //scanScene.remove(meshTeapot);
            meshRing.geometry.dispose();
            scanScene.remove(meshRing);
            meshPlane.geometry.dispose();
            scanScene.remove(meshPlane);
            meshBeam.geometry.dispose();
            scanScene.remove(meshBeam);
            meshEmitter.geometry.dispose();
            scanScene.remove(meshEmitter);
            mainModel.geometry.dispose();
            scanScene.remove(mainModel);
        }
        scanSceneBuild();
        /*
        meshEmitter.position.y = scanHeight * slicePos;
        meshPlane.position.y = scanHeight * slicePos;
        meshBeam.position.y = 0.001 + scanHeight * slicePos;
        meshRing.position.y = scanHeight * slicePos;
        */

        rebuildScan = false;
    }
    scanRenderer.render(scanScene, scanCamera);
}

function renderSlice(){
    sliceRenderer.render(sliceScene, sliceCamera);
}
function renderCat(){
    
}

//Bresenham's line algo, fast but not rasterized
function drawLineBresenham(x0, y0, x1, y1, intensity, destArray) {//All the drawn pixels have the same intensity
    /*
    function draw(x,y){
        if (x>=0 && y>=0 && x <sliceDimension && y < sliceDimension){
            sliceGrid[x][y] += intensity;
        }
    }
    */

    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = (x0 < x1) ? 1 : -1;
    var sy = (y0 < y1) ? 1 : -1;
    var err = dx - dy;

    while(true) {
        destArray[x0][y0] += intensity;

        if (Math.abs(x0 - x1) < 0.0001 && Math.abs(y0 - y1) < 0.0001) break;
        var e2 = 2*err;
        if (e2 > -dy) {
            err -= dy;
            x0  += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0  += sy;
        }
    }
}
//Xiaolin Wu's line algo, draws line, needs a single pixel drawing callback function.
function drawLineWu(x0,y0,x1,y1,intensity, destArray){
    /*
    x0 = Math.round(x0)
    x1 = Math.round(x1)
    y0 = Math.round(y0)
    y1 = Math.round(y1)
    */
    function draw(x,y,value){
        if (x>=0 && y>=0 && x <sliceDimension && y < sliceDimension){
            destArray[x][y] += value*intensity;
        }
    }
    let steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);//bool
    
    if (steep){
        let var0 = x0;
        let var1 = x1;
        x0 = y0;
        y0 = var0;
        x1 = y1;
        y1 = var1;
    }
    if (x0 > x1){
        let varx = x0;
        let vary = y0;
        x0 = x1;
        x1 = varx;
        y0 = y1;
        y1 = vary;
    }
    
    let dx = x1 - x0
    let dy = y1 - y0
    let gradient = dy / dx
    if (dx == 0.0){
        gradient = 1.0
    }

    // handle first endpoint
    let xend = Math.round(x0)
    let yend = y0 + gradient * (xend - x0)
    let xgap = rfpart(x0 + 0.5)
    let xpxl1 = xend // this will be used in the main loop
    let ypxl1 = Math.floor(yend)
    if (steep){
        draw(ypxl1,   xpxl1, rfpart(yend) * xgap)
        draw(ypxl1+1, xpxl1,  fpart(yend) * xgap)
    }else{
        draw(xpxl1, ypxl1  , rfpart(yend) * xgap)
        draw(xpxl1, ypxl1+1,  fpart(yend) * xgap)
    }
    let intery = yend + gradient // first y-intersection for the main loop
    
    // handle second endpoint
    xend = Math.round(x1)
    yend = y1 + gradient * (xend - x1)
    xgap = fpart(x1 + 0.5)
    let xpxl2 = xend //this will be used in the main loop
    let ypxl2 = Math.floor(yend)
    if (steep){
        draw(ypxl2  , xpxl2, rfpart(yend) * xgap)
        draw(ypxl2+1, xpxl2,  fpart(yend) * xgap)
    }else{
        draw(xpxl2, ypxl2,  rfpart(yend) * xgap)
        draw(xpxl2, ypxl2+1, fpart(yend) * xgap)
    }
    
    // main loop
    if (steep){
        for (let x = xpxl1 + 1; x < xpxl2; x++){
            draw(Math.floor(intery)  , x, rfpart(intery))
            draw(Math.floor(intery)+1, x,  fpart(intery))
            intery = intery + gradient
        }
    }else{
        for (let x = xpxl1 + 1; x < xpxl2; x++){
            draw(x, Math.floor(intery),  rfpart(intery))
            draw(x, Math.floor(intery)+1, fpart(intery))
            intery = intery + gradient
        }
    }
}
//fractional part of x
function fpart(x){
    return x - Math.floor(x);
}
//complementary to 1 of the fractional part
function rfpart(x){
    return 1 - fpart(x);
}

function meshFromGrid(sideLength, gridFrom, postF){//Return a Mesh representing the pixel grid. Needs a post processing function to transform the input values
    let maxPixel = 0;
    for (let i = 0; i < sideLength; i++) {
        for (let j = 0; j < sideLength; j++){
            if(gridFrom[i][j]>maxPixel){
                maxPixel = gridFrom[i][j];
            }
        }
    }
    let size = sideLength*sideLength; //Pixel count
    let data = new Uint8Array(size * 3); //size*3: pixels occupy space in the buffer
    let ind = 0;

    for (let i = 0; i < sideLength; i++) {
        for (let j = 0; j < sideLength; j++){
            
            data[ind] = 255 * postF(gridFrom[i][j] / maxPixel);
            data[ind + 1] = data[ind];
            data[ind + 2] = data[ind];
            /*
            data[ind] = 255 * Math.random()
            data[ind + 1] = 255 * Math.random()
            data[ind + 2] = 255 * Math.random()
            */
            ind+=3;
        }
    }
    // Create data literary objects RGB format: THREE.RGBFormat
    let texture = new THREE.DataTexture(data, sideLength, sideLength, THREE.RGBFormat);
    texture.needsUpdate = true; //Texture update
    
    let planeGeometry = new THREE.PlaneGeometry(1,1); //Rectangular plane
    let planeMaterial = new THREE.MeshPhongMaterial({map: texture});
    return new THREE.Mesh(planeGeometry, planeMaterial);
}
function postProcess(sideLength, gridFrom, floorInten, cropCircle){
    let gridTo = []
    for(let i=0; i<sideLength; i++){
        gridTo.push(gridFrom[i].slice())//Transfers array line by line
    }

    let maxPixel = 0;
    for (let i = 0; i < sideLength; i++) {
        for (let j = 0; j < sideLength; j++){
            gridTo[i][j]=gridFrom[i][j]
            if((i-sideLength/2)**2 + (j-sideLength/2)**2>(cropCircle*sideLength/2)**2){
                //gridTo[i][j] = 0 
                //We don't consider the values outside the clipping circle for max Pixel
                //We will set the value later when everything is normalized
            }else{
                if(gridTo[i][j]>maxPixel){
                    maxPixel = gridTo[i][j];
                }
            }
        }
    }
    let xprime;
    for (let i = 0; i < sideLength; i++) {
        for (let j = 0; j < sideLength; j++){
            xprime =  gridTo[i][j] / maxPixel;
            
            if (floorVal==1) gridTo[i][j] = 0;
            if (xprime<floorVal){
                gridTo[i][j] = 0;
            }else{
                gridTo[i][j] = (xprime-floorVal)/(1-floorVal);
            }

            if((i-sideLength/2)**2 + (j-sideLength/2)**2>(cropCircle*sideLength/2)**2){
                gridTo[i][j] = 0;
            }
        }
    }
    return gridTo
}


function rayTriangleIntersect(origin, direction, v0, v1, v2){
    // compute plane's normal
    let v0v1 = new THREE.Vector3()
    v0v1.subVectors(v1, v0);
    let v0v2 = new THREE.Vector3()
    v0v2.subVectors(v2, v0); 
    // no need to normalize
    let N = new THREE.Vector3()
    N.crossVectors(v0v1, v0v2)
    //let area2 = N.length(); 

    // Step 1: finding P

    // check if ray and plane are parallel ?
    let NdotRayDirection = N.dot(direction); 
    if (Math.abs(NdotRayDirection) < 0.0001) return false; // they are parallel so they don't intersect ! 

    // compute d parameter using equation 2
    let d = N.dot(v0); 

    // compute t (equation 3)
    let t = (N.dot(origin) + d) / NdotRayDirection; 
    // check if the triangle is in behind the ray
    //if (t < 0) return false; // the triangle is behind 

    // compute the intersection point using equation 1
    //P = orig + t * dir
    let P = new THREE.Vector3()
    P.add(origin)
    direction.multiplyScalar(t)
    P.add(direction)

    // Step 2: inside-outside test
    let C = new THREE.Vector3(); // vector perpendicular to triangle's plane 

    // edge 0
    let edge0 = new THREE.Vector3()
    edge0.subVectors(v1, v0); 
    let vp0 = new THREE.Vector3()
    vp0.subVectors(P, v0); 
    C.crossVectors(edge0, vp0); 
    if (N.dot(C) < 0) return false; // P is on the right side 

    // edge 1
    let edge1 = new THREE.Vector3()
    edge1.subVectors(v2, v1); 
    let vp1 = new THREE.Vector3()
    vp1.subVectors(P, v1);
    C.crossVectors(edge1, vp1);
    if (N.dot(C) < 0)  return false; // P is on the right side

    // edge 2
    let edge2 = new THREE.Vector3()
    edge2.subVectors(v0, v2);
    let vp2 = new THREE.Vector3()
    vp2.subVectors(P, v2); 
    C.crossVectors(edge2, vp2); 
    if (N.dot(C) < 0) return false; // P is on the right side; 
    
    origin.addScaledVector(direction, t)
    return origin; // this ray hits the triangle 
}
//Moller Trumbore intersection algorithm
function rayTriangleMollerTrumbore(rayOrigin, rayDirection, v0, v1, v2)
{
    let epsilon = 0.000001;
    let edge1 = new THREE.Vector3()
    let edge2 = new THREE.Vector3()
    let h = new THREE.Vector3()
    let s = new THREE.Vector3()
    let q = new THREE.Vector3()

    let a, f, u, v
    //float a,f,u,v;
    edge1.subVectors(v1, v0)
    edge2.subVectors(v2, v0);
    h.crossVectors(rayDirection, edge2);
    a = edge1.dot(h);
    if (a > -epsilon && a < epsilon) return false;    // Le rayon est parallèle au triangle.

    f = 1.0/a;
    s.subVectors(rayOrigin, v0);
    u = f * s.dot(h);
    if (u < 0.0 || u > 1.0) return false;
    q.crossVectors(s, edge1);
    v = f * rayDirection.dot(q);
    if (v < 0.0 || u + v > 1.0) return false;

    // On calcule t pour savoir ou le point d'intersection se situe sur la ligne.
    let t = f * edge2.dot(q);
    if (t > epsilon) // Intersection avec le rayon
    {
        let retret = new THREE.Vector3()
        retret = rayOrigin.clone()
        retret.addScaledVector(rayDirection, t)
        return retret;
    }else return false;
}

function intersectObject(rayOrigin, rayDirection, obj)
{
    let intersects = [];
    let ret;
    for (let i=0; i < obj.faces.length; i++){
        //faces[i].a refers to a Vector3 index in faces.vertices[]
        //ret = rayTriangleMollerTrumbore(
        ret = rayTriangleMollerTrumbore(rayOrigin, rayDirection, obj.vertices[obj.faces[i].a], obj.vertices[obj.faces[i].b], obj.vertices[obj.faces[i].c]);
        if (ret!==false){
            intersects.push(ret);
        }
    }
    return intersects.slice();
}
