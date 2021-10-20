window.gltfLoader = new THREE.GLTFLoader();

import {XREstimatedLight} from "./XREstimatedLight.js";

class Reticle extends THREE.Object3D {
    constructor() {
        super();

        this.loader = new THREE.GLTFLoader();
        this.loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", (gltf) => {
            this.add(gltf.scene);
        })

        this.visible = false;
    }
}

//Check for WebXR Support
(async function() {
    const isArSessionSupported =
        navigator.xr &&
        navigator.xr.isSessionSupported &&
        await navigator.xr.isSessionSupported("immersive-ar");
    if (isArSessionSupported) {
        document.getElementById("enter-ar").addEventListener("click", window.app.activateXR)
    }
})();

//Global variables (Should try to get rid of these)
const WallPoints = [];
const WallPlanes = [];
const WallLines = [];

const DoorPoints = [];
const DoorPlanes = [];
const DoorLines = [];

const WindowPoints = [];
const WindowPlanes = [];
const WindowLines = [];


const SpawnedCeilingTrims = [];
const SpawnedFloorTrims = [];
const SpawnedWallTrims = [];
const SetIDs = [];
const DecorationTypes =
    {
        CeilingTrim: "ceilingTrim",
        FloorTrim: "floorTrim",
        WallTrim: "wallTrim",
        Decoration: "decoration",
        Set: "set",
        FillDecoration: "fillDecoration",
        UplightTrim: "uplightTrim",
        Doortrim: "doorTrim"
    }

    let decoType = DecorationTypes.Decoration;


const SetTypes =
    {
        Modern: "modern",
        Classic: "classic",
        Ornamented: "ornamented",
        Eclectisch: "eclestisch"
    }

    let setType = SetTypes.Test;

let reticleHitTestResult;

//PLANE DETECTION
//First step, place 2 points to determine the height
let IsDeterminingHeightWalls = true;
let IsDeterminingHeightDoors = false;

let WallHeight = 0;
let DoorHeight = 0;

//Ensures all the dots are placed on the same Y position
let ConstrainedYPosWalls = 0;
let ConstrainedYPosDoors = 0;

//Second step, place points in the corners of the walls
let PlacingPointsWalls = false;
let NrOfWalls = 0;
let PlacedFirstPointWalls = false;

let PlacingPointsDoors = false;
let NrOfDoors = 0;
let PlacedFirstPointDoors = false;

//Third step, if a placed point is close enough to a previous point close off and move to next step
const MinDistance = 0.2;
let FinishedPlacingWalls = false;
let FinishedPlacingDoors = true;
//-------------------------------------------------------------------------------------------------

let ModelID;
let SpawnedDecorations = [];
let HitPlaneDirection;
let IsDirectionX = false;
let CurrentFrame;
let pmremGenerator;

//Variables to control GUI
let gui;
let paramsTrimColor = {trimColor: "#919197" };
let paramsDecorationColor = {decorationColor: "#919197" };
let paramsVisibility = {showGuides: true};
let trimColor;
let decorationColor;

let defaultEnv;
let stats = new Stats();
let previewLine;

//save certain buttons so we can easily keep track of them and manipulate them
let DoneButton;
let DoorsButton;

//Container class to handle WebXR logic
//Adapted from the AR with WebXR workshop project by Google
class App {

    SetModelID(id, type)
    {
        ModelID = id;

        if (type === "ceilingTrim")
            decoType = DecorationTypes.CeilingTrim;
        if (type === "floorTrim")
            decoType = DecorationTypes.FloorTrim;
        if (type === "wallTrim")
            decoType = DecorationTypes.WallTrim;
        if (type === "decoration")
            decoType = DecorationTypes.Decoration;
        if (type === "uplightTrim")
            decoType = DecorationTypes.UplightTrim;
        if (type === "set")
        {
            decoType = DecorationTypes.Set;
            if (id === "modern")
                setType = SetTypes.Modern;
            if (id === "classic")
                setType = SetTypes.Classic;
            if (id === "ornamented")
                setType = SetTypes.Ornamented;
            if (id === "eclestisch")
                setType = SetTypes.Eclectisch;
            this.assignSetIDs();
        }
        if (type === "fillDecoration")
            decoType = DecorationTypes.FillDecoration;
        if (type === "doorTrim")
            decoType = DecorationTypes.Doortrim;

        let preview;
        if (decoType !== DecorationTypes.Set)
        {
            window.gltfLoader.setPath('3D/');
            window.gltfLoader.load(id + '.gltf', (gltf) => {
                let scene = gltf.scene;
                scene.traverse((child) => {
                    if (child.isMesh)
                    {
                        preview = child.parent;
                        this.scene.remove(this.reticle);

                        if (decoType !== DecorationTypes.Decoration &&
                        decoType !== DecorationTypes.FillDecoration)
                        {
                            let currScale = preview.scale;
                            currScale.x /= 2
                            preview.scale.set(currScale.x,currScale.y,currScale.z);
                        }

                        this.reticle = preview;
                        this.scene.add(this.reticle);
                    }
                })
            })
        }
        else
        {
            this.scene.remove(this.reticle);
            this.reticle = new Reticle();
            this.scene.add(this.reticle);
        }
    }

    assignSetIDs()
    {
        SetIDs.length = 0;
        switch (setType)
        {
            case SetTypes.Modern:
                SetIDs.push("C393");
                SetIDs.push("SX181");
                SetIDs.push("P6020");
                break;

            case SetTypes.Classic:
                SetIDs.push("C341");
                SetIDs.push("P8020");
                SetIDs.push("SX118");
                break;

            case SetTypes.Ornamented:
                SetIDs.push("P7030");
                SetIDs.push("C338A");
                SetIDs.push("SX118");
                break;

            case SetTypes.Eclectisch:
                SetIDs.push("C422");
                SetIDs.push("SX118");
                SetIDs.push("P8020");
                break;
        }
    }

    //General UI functions
    openNav() {
        document.getElementById("mySidenav").style.width = "250px";
        gui.hide();
        document.getElementsByTagName("button")[0].style.display = "none";
    }

    closeNav() {
        document.getElementById("mySidenav").style.width = "0";
        gui.show();
        document.getElementsByTagName("button")[0].style.display = "block";
    }

    openSub(id)
    {
        if (document.getElementById(id).style.display === "none")
            document.getElementById(id).style.display = "block";
        else
            document.getElementById(id).style.display = "none";

    }

    ClipToLength(startPos, object, length, clipNormal)
    {
        let clippingPlane = [new THREE.Plane(clipNormal, startPos + length)];
        let test = new THREE.PlaneHelper(clippingPlane[0],2,0x0000ff )
        this.scene.add(test);

        object.traverse((child) => {
            if(child.isMesh) {
                if (child.material.clippingPlanes === null)
                    child.material.clippingPlanes = clippingPlane;

                else
                child.material.clippingPlanes.push(clippingPlane[0]);
            }
        })
    }

    /**
     * Run when the Start AR button is pressed.
     */

    activateXR = async () => {
        try {
            /** initialize a WebXR session using extra required features. */
            this.xrSession = await navigator.xr.requestSession("immersive-ar", {
                requiredFeatures: ['hit-test', 'dom-overlay', 'anchors', 'light-estimation'],
                domOverlay: { root: document.body }
            });

            /** Create the canvas that will contain our camera's background and our virtual scene. */
            this.createXRCanvas();

            /** With everything set up, start the app. */
            await this.onSessionStarted();

            /** Remove AR button */
            document.getElementById("enter-ar").remove();
        } catch(e) {
            console.log(e);
        }
    }

    /**
     * Add a canvas element and initialize a WebGL context that is compatible with WebXR.
     */
    createXRCanvas() {
        this.canvas = document.createElement("canvas");
        document.body.appendChild(this.canvas);
        this.gl = this.canvas.getContext("webgl", {xrCompatible: true});

        this.xrSession.updateRenderState({
            baseLayer: new XRWebGLLayer(this.xrSession, this.gl)
        });
    }

    /**
     * Called when the XRSession has begun. Here we set up our three.js
     * renderer, scene, and camera and attach our XRWebGLLayer to the
     * XRSession and kick off the render loop.
     */
    onSessionStarted = async () => {
        /** Add the `ar` class to our body, which will hide our 2D components. */
        document.body.classList.add('ar');

        /** Setup an XRReferenceSpace using the "local" coordinate system. */
        this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');

        /** Create another XRReferenceSpace that has the viewer as the origin. */
        this.viewerSpace = await this.xrSession.requestReferenceSpace('viewer');

        /** Perform hit testing using the viewer as origin. */
        this.hitTestSource = await this.xrSession.requestHitTestSource({ space: this.viewerSpace });

        /** Start a rendering loop using this.onXRFrame. */

        //Initialize stats panel
        stats.showPanel(0);
        stats.dom.style.left = "25px";
        stats.dom.style.top = "700px";
        document.body.appendChild(stats.dom);

        this.xrSession.requestAnimationFrame(this.onXRFrame);

        this.xrSession.addEventListener("select", this.onSelect);

        /** To help with working with 3D on the web, we'll use three.js. */
        this.setupThreeJs();

    }

    /**
     * Called on the XRSession's requestAnimationFrame.
     * Called with the time and XRPresentationFrame.
     */
    onXRFrame = (time, frame) => {

        stats.begin();

        /** Store current frame*/
        CurrentFrame = frame;

        /** Queue up the next draw request. */
        this.xrSession.requestAnimationFrame(this.onXRFrame);

        /** Bind the graphics framebuffer to the baseLayer's framebuffer. */
        const framebuffer = this.xrSession.renderState.baseLayer.framebuffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
        this.renderer.setFramebuffer(framebuffer);

        /** Retrieve the pose of the device.
         * XRFrame.getViewerPose can return null while the session attempts to establish tracking. */
        const pose = frame.getViewerPose(this.localReferenceSpace);
        if (pose) {
            /** In mobile AR, we only have one view. */
            const view = pose.views[0];

            const viewport = this.xrSession.renderState.baseLayer.getViewport(view);
            this.renderer.setSize(viewport.width, viewport.height)

            /** Use the view's transform matrix and projection matrix to configure the THREE.camera. */
            this.camera.matrix.fromArray(view.transform.matrix)
            this.camera.projectionMatrix.fromArray(view.projectionMatrix);
            this.camera.updateMatrixWorld(true);
            //
            //   /** Conduct hit test. */
            const hitTestResults = frame.getHitTestResults(this.hitTestSource);

            //
            //   /** If we have results, consider the environment stabilized. */
            if (!this.stabilized && hitTestResults.length > 0) {
                this.stabilized = true;
                document.getElementById("HeightIcon").style.display = "block";
            }
            if (hitTestResults.length > 0) {
                let hitPose = hitTestResults[0].getPose(this.localReferenceSpace);

                /** Update the reticle position. */
                reticleHitTestResult = hitTestResults[0];
                this.reticle.visible = true;
                this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
                this.reticle.updateMatrixWorld(true);
            }

            //Draw preview lines while placing points to define walls
            if (PlacingPointsWalls && PlacedFirstPointWalls)
            {
                this.scene.remove(previewLine);
                let PreviewPoints = [];
                let InitialPos = new THREE.Vector3(0,0,0);
                InitialPos.copy(this.reticle.position);
                InitialPos.y = ConstrainedYPosWalls;
                PreviewPoints.push(InitialPos);

                let adjustedPos = new THREE.Vector3(0,0,0);
                adjustedPos.copy(this.reticle.position);
                adjustedPos.y = ConstrainedYPosWalls - WallHeight;
                PreviewPoints.push(adjustedPos);

                let copiedPos1 = new THREE.Vector3(0,0,0);
                let copiedPos2 = new THREE.Vector3(0,0,0);
                let arrLength = WallPoints.length;

                copiedPos1.copy(WallPoints[arrLength - 1].anchoredObject.position);
                copiedPos2.copy(WallPoints[arrLength - 2].anchoredObject.position);

                PreviewPoints.push(copiedPos1);
                PreviewPoints.push(copiedPos2);
                PreviewPoints.push(InitialPos);

                const material = new THREE.LineBasicMaterial({color: 0x0000ff});
                const geometry = new THREE.BufferGeometry().setFromPoints(PreviewPoints);
                const line = new THREE.Line(geometry,material);
                this.scene.add(line);
                previewLine = line;
            }

            // only update the object's position if it's still in the list
            // of frame.trackedAnchors
            for (const {anchoredObject, anchor} of WallPoints)
            {
                if (!frame.trackedAnchors.has(anchor)) {
                    continue;
                }
                const anchorPose = frame.getPose(anchor.anchorSpace, this.localReferenceSpace);
                anchoredObject.matrix.set(anchorPose.transform.matrix);
            }

            for (const {anchoredObject, anchor} of SpawnedCeilingTrims)
            {
                if (!frame.trackedAnchors.has(anchor)) {
                    continue;
                }
                const anchorPose = frame.getPose(anchor.anchorSpace, this.localReferenceSpace);
                anchoredObject.matrix.set(anchorPose.transform.matrix);
            }

            for (const {anchoredObject, anchor} of SpawnedFloorTrims)
            {
                if (!frame.trackedAnchors.has(anchor)) {
                    continue;
                }
                const anchorPose = frame.getPose(anchor.anchorSpace, this.localReferenceSpace);
                anchoredObject.matrix.set(anchorPose.transform.matrix);
            }

            for (const {anchoredObject, anchor} of SpawnedWallTrims)
            {
                if (!frame.trackedAnchors.has(anchor)) {
                    continue;
                }
                const anchorPose = frame.getPose(anchor.anchorSpace, this.localReferenceSpace);
                anchoredObject.matrix.set(anchorPose.transform.matrix);
            }

            for (const {anchoredObject, anchor} of SpawnedDecorations)
            {
                if (!frame.trackedAnchors.has(anchor)) {
                    continue;
                }
                const anchorPose = frame.getPose(anchor.anchorSpace, this.localReferenceSpace);
                anchoredObject.matrix.set(anchorPose.transform.matrix);
            }


            /** Render the scene with THREE.WebGLRenderer. */
            this.renderer.render(this.scene, this.camera)

            stats.end();
        }
    }

    /**
     * Initialize three.js specific rendering code, including a WebGLRenderer,
     * a demo scene, and a camera for viewing the 3D content.
     */
    setupThreeJs() {
        /** To help with working with 3D on the web, we'll use three.js.
         * Set up the WebGLRenderer, which handles rendering to our session's base layer. */
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
            canvas: this.canvas,
            context: this.gl
        });

        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.localClippingEnabled = true;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.xr = this.xrSession;
        this.renderer.xr.enabled = true;

        /** Initialize our demo scene. */
        const scene = new THREE.Scene();

        // The materials will render as a black mesh
        // without lights in our scenes. Let's add an ambient light
        // so our material can be visible, as well as a directional light
        // for the shadow.
        const light = new THREE.AmbientLight(0x222222);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 1, 0.75).normalize();
        const xrLight = new XREstimatedLight(this.renderer);

        //Set up light estimation event listeners
        xrLight.addEventListener('estimationstart',() =>{
            console.log("Started light estimation");
            this.scene.add(xrLight);
            this.scene.remove(light);
            this.scene.remove(directionalLight);
            if (xrLight.environment)
            {
                scene.environment = xrLight.environment;
            }
        });

        xrLight.addEventListener('estimationend', () =>{
            console.log("Ended light estimation");
            this.scene.remove(xrLight);
            this.scene.environment = defaultEnv;
            this.scene.add(light);
            this.scene.add(directionalLight);
        })



        // We want this light to cast shadow.
        directionalLight.castShadow = true;

        // Make a large plane to receive our shadows
        const planeGeometry = new THREE.PlaneGeometry(2000, 2000);

        // Rotate our plane to be parallel to the floor
        planeGeometry.rotateX(-Math.PI / 2);

        // Create a mesh with a shadow material, resulting in a mesh
        // that only renders shadows once we flip the `receiveShadow` property.
        const shadowMesh = new THREE.Mesh(planeGeometry, new THREE.ShadowMaterial({
            color: 0x111111,
            opacity: 0.2,
        }));

        // Give it a name so we can reference it later, and set `receiveShadow`
        // to true so that it can render our model's shadow.
        shadowMesh.name = 'shadowMesh';
        shadowMesh.receiveShadow = true;
        shadowMesh.position.y = 10000;

        this.scene = scene;
        this.reticle = this.CreateSphere(new THREE.Vector3(0,0,0));
        //this.reticle.rotateX(0.5 * Math.PI);
        this.scene.add(this.reticle);

        /** We'll update the camera matrices directly from API, so
         * disable matrix auto updates so three.js doesn't attempt
         * to handle the matrices independently. */
        this.camera = new THREE.PerspectiveCamera();
        this.camera.matrixAutoUpdate = false;

        pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
    }

    UpdateTrimColor()
    {
        trimColor = new THREE.Color(paramsTrimColor.trimColor);
        for(let currTrim = 0; currTrim < SpawnedCeilingTrims.length; ++currTrim)
        {
        SpawnedCeilingTrims[currTrim].anchoredObject.traverse((child) => {
            if (child.isMesh)
            {
                child.material.color.set(trimColor);
            }
            })
        }

        for(let currTrim = 0; currTrim < SpawnedFloorTrims.length; ++currTrim)
        {
            SpawnedFloorTrims[currTrim].anchoredObject.traverse((child) => {
                if (child.isMesh) {
                    child.material.color.set(trimColor);
                }
            })
        }

        for(let currTrim = 0; currTrim < SpawnedWallTrims.length; ++currTrim)
        {
            SpawnedWallTrims[currTrim].anchoredObject.traverse((child) => {
                if (child.isMesh) {
                    child.material.color.set(trimColor);
                }
            })
        }
    }

    UpdateDecorationColor()
    {
        decorationColor = new THREE.Color(paramsDecorationColor.decorationColor);
        for(let currTrim = 0; currTrim < SpawnedDecorations.length; ++currTrim)
        {
            SpawnedDecorations[currTrim].anchoredObject.traverse((child) => {
                if (child.isMesh)
                {
                    child.material.color.set(decorationColor);
                }
            })
        }
    }

    UpdateGuideVisibility()
    {
        let isActive = paramsVisibility.showGuides;

            for (let currentPoint = 0; currentPoint < WallPoints.length; ++currentPoint)
            {
                WallPoints[currentPoint].anchoredObject.visible = isActive;
            }

            for (let currentLine = 0; currentLine < WallLines.length; ++currentLine)
            {
                WallLines[currentLine].visible = isActive;
            }
    }

    /** Place a point when the screen is tapped.
     * Once 2 or more points have been placed create lines*/
        //Ensure to change Z to Y when testing vertical planes
    onSelect = () =>
    {
        this.HandleWallSelection();
        this.HandleDoorSelection();
    }

    HandleWallSelection()
    {
        if (PlacingPointsWalls)
        {
            for (const {anchoredObject, anchor} of WallPoints)
            {
                let distanceToMarker = anchoredObject.position.distanceToSquared(this.reticle.position);
                if (distanceToMarker < MinDistance)
                {
                    FinishedPlacingWalls = true;
                    PlacingPointsWalls = false;
                    this.scene.remove(previewLine);
                    previewLine = null;
                    this.CreatePlanes();
                    this.CreateDoneButton();
                    this.CreateSelectDoorsButton();
                    document.getElementById("WallsIcon").style.display = "none";
                    /**
                    //this.DrawPlanes();
                    document.getElementById("OpenButton").style.display = "block";
                    this.CreatePlaceButton();
                    this.CreateResetButton();

                    //Set up colorPicker
                    gui = new dat.GUI();

                    //Manually call update so color variable gets properly initalized with the default value of the picker
                    this.UpdateTrimColor();
                    this.UpdateDecorationColor();

                    //Set a callback so that whenever user changes a value, it calls the update
                    gui.addColor(paramsTrimColor, 'trimColor').onChange(this.UpdateTrimColor);
                    gui.addColor(paramsDecorationColor, 'decorationColor').onChange(this.UpdateDecorationColor);
                    gui.add(paramsVisibility, 'showGuides').onChange(this.UpdateGuideVisibility);

                    break;*/
                }
            }
            if (!FinishedPlacingWalls)
            {
                let Point1;
                let FirstLocation = new THREE.Vector3(0,0,0);
                FirstLocation.copy(this.reticle.position);
                FirstLocation.y = ConstrainedYPosWalls;

                //Used to ensure that the else code doesn't execute when placing first point
                if (!PlacedFirstPointWalls)
                {
                    PlacedFirstPointWalls = true;
                }

                /**else
                 {
                    let IndexPrevPoint = WallPoints.length - 2;
                    let prevPoint = WallPoints[IndexPrevPoint].anchoredObject;
                    let direction = new THREE.Vector3(0,0,0);
                    direction.copy(FirstLocation);
                    direction.sub(prevPoint.position);
                    let isDirectionX = Math.abs(direction.x) > Math.abs(direction.z);

                    if (isDirectionX)
                        FirstLocation.y = prevPoint.position.y;
                    else
                        FirstLocation.x = prevPoint.position.x;
                }*/

                Point1 = this.CreateSphere(FirstLocation);


                reticleHitTestResult.createAnchor().then((anchor) =>
                {
                    WallPoints.push({
                        anchoredObject: Point1,
                        anchor: anchor
                    });
                });

                let SecondLocation = new THREE.Vector3(0,0,0);
                SecondLocation.copy(FirstLocation);
                SecondLocation.y = ConstrainedYPosWalls - WallHeight;
                let Point2 = this.CreateSphere(SecondLocation);
                let hitPose = reticleHitTestResult.getPose(this.localReferenceSpace);
                let transformPosition = new THREE.Vector3(0,0,0);
                transformPosition.copy(hitPose.transform.position);
                transformPosition.y = ConstrainedYPosWalls - WallHeight;
                let XRTransform = new XRRigidTransform(transformPosition, hitPose.transform.orientation);

                reticleHitTestResult.createAnchor(XRTransform, this.localReferenceSpace).then((anchor) =>
                {
                    WallPoints.push({
                        anchoredObject: Point2,
                        anchor: anchor
                    });

                    if (WallPoints.length >= 4)
                    {
                        ++NrOfWalls;
                    }
                });

                if (WallPoints.length > 0)
                {
                    let test = previewLine.clone();
                    WallLines.push(test);
                    previewLine = null;
                }
            }
        }

        if (IsDeterminingHeightWalls)
        {
            let createdSphere = this.CreateSphere(this.reticle.position);
            reticleHitTestResult.createAnchor().then((anchor) =>
            {
                WallPoints.push({
                    anchoredObject: createdSphere,
                    anchor: anchor
                });

                if (WallPoints.length === 2)
                {
                    ConstrainedYPosWalls = WallPoints[1].anchoredObject.position.y;
                    //DELETE - Just added it now for testing purposes
                    ConstrainedYPosWalls = 1;
                    WallHeight = ConstrainedYPosWalls - WallPoints[0].anchoredObject.position.y;
                    this.ResetWallPoints();
                    IsDeterminingHeightWalls = false;
                    PlacingPointsWalls = true;
                    document.getElementById("HeightIcon").style.display = "none";
                    document.getElementById("WallsIcon").style.display = "block";
                }
            });
        }
    }

    HandleDoorSelection()
    {
        if (PlacingPointsDoors)
        {
            //Select bottom left - top right
            let createdSphere = this.CreateSphere(this.reticle.position);
            reticleHitTestResult.createAnchor().then((anchor) => {
                DoorPoints.push({
                    anchoredObject: createdSphere,
                    anchor: anchor
                });

                if (DoorPoints.length === 2)
                {
                    //Generate top left
                    let topLeftPosition = DoorPoints[0].anchoredObject.position.clone();
                    topLeftPosition.y = DoorPoints[1].anchoredObject.position.y;
                    let topLeftSphere = this.CreateSphere(topLeftPosition);

                    //Generate bottom right
                    let bottomRightPosition = DoorPoints[1].anchoredObject.position.clone();
                    bottomRightPosition.y = DoorPoints[0].anchoredObject.position.y;
                    let bottomRightSphere = this.CreateSphere(bottomRightPosition);


                    DoorPoints.push({
                        anchoredObject: topLeftSphere,
                        anchor: anchor
                    });

                    DoorPoints.push({
                        anchoredObject: bottomRightSphere,
                        anchor: anchor
                    });

                    this.DrawDoor();
                }
            });
        }
    }

    HandleWindowSelection()
    {
        
    }

    ResetWallPoints()
    {
        for(let i= 0; i < WallPoints.length; ++i)
        {
            this.scene.remove(WallPoints[i].anchoredObject);
            WallPoints[i].anchor.delete();
        }
        WallPoints.length = 0;
    }

    ResetDoorPoints()
    {
        for(let i= 0; i < DoorPoints.length; ++i)
        {
            this.scene.remove(DoorPoints[i].anchoredObject);
            DoorPoints[i].anchor.delete();
        }
        DoorPoints.length = 0;
    }

    ResetCeilingTrims()
    {
        for(let i= 0; i < SpawnedCeilingTrims.length; ++i)
        {
            this.scene.remove(SpawnedCeilingTrims[i].anchoredObject);
            SpawnedCeilingTrims[i].anchor.delete();
        }
        SpawnedCeilingTrims.length = 0;
    }

    ResetFloorTrims()
    {
        for(let i= 0; i < SpawnedFloorTrims.length; ++i)
        {
            this.scene.remove(SpawnedFloorTrims[i].anchoredObject);
            SpawnedFloorTrims[i].anchor.delete();
        }
        SpawnedFloorTrims.length = 0;
    }

    ResetWallTrims()
    {
        for(let i= 0; i < SpawnedWallTrims.length; ++i)
        {
            this.scene.remove(SpawnedWallTrims[i].anchoredObject);
            SpawnedWallTrims[i].anchor.delete();
        }
        SpawnedWallTrims.length = 0;
    }

    ResetDecorations()
    {
        for(let i= 0; i < SpawnedDecorations.length; ++i)
        {
            this.scene.remove(SpawnedDecorations[i].anchoredObject);
            SpawnedDecorations[i].anchor.delete();
        }
        SpawnedDecorations.length = 0;
    }

    CreateSphere(position)
    {
        const sphereGeometry = new THREE.SphereGeometry(0.05,32,16);
        const sphereMaterial = new THREE.MeshBasicMaterial({color: 0xfff00});
        const sphere = new THREE.Mesh(sphereGeometry,sphereMaterial);
        sphere.position.copy(position);
        this.scene.add(sphere)
        return sphere;
    }

    CreatePlanes()
    {
        let startIndex = 0;
        for(let i = 0; i < NrOfWalls; ++i)
        {
            //Add Points that define plane to array and store that array
            //LeftTop - LeftBottom - RightBottom - RightTop
            const planePoints = [];
            planePoints.push(WallPoints[startIndex].anchoredObject.position);
            planePoints.push(WallPoints[startIndex + 1].anchoredObject.position)
            planePoints.push(WallPoints[startIndex + 3].anchoredObject.position)
            planePoints.push(WallPoints[startIndex + 2].anchoredObject.position)
            WallPlanes.push(planePoints);
            startIndex += 2;
        }
    }

    DrawDoor()
    {
        var linePoints = [];
        linePoints.push(DoorPoints[2].anchoredObject.position.clone());
        linePoints.push(DoorPoints[0].anchoredObject.position.clone());
        linePoints.push(DoorPoints[3].anchoredObject.position.clone());
        linePoints.push(DoorPoints[1].anchoredObject.position.clone());
        linePoints.push(DoorPoints[2].anchoredObject.position.clone());

        const material = new THREE.LineBasicMaterial({color: 0xff0000});
        const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const line = new THREE.Line(geometry,material);
        this.scene.add(line);
        DoorLines.push(line);
        DoorPlanes.push(linePoints);
        this.ResetDoorPoints();
    }

    DrawPlanes()
    {
        for(let i = 0; i < WallPlanes.length; ++i)
        {
            var Points = WallPlanes[i];
            var linePoints = [];
            for(let j = 0; j < Points.length; ++j)
            {
                let point = new THREE.Vector3(0,0,0);
                point.copy(Points[j]);
                linePoints.push(point);
            }
            let closePoint = new THREE.Vector3(0,0,0);
            closePoint.copy(Points[0]);
            linePoints.push(closePoint);
            const material = new THREE.LineBasicMaterial({color: 0x0000ff});
            const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
            const line = new THREE.Line(geometry,material);
            this.scene.add(line);
            WallLines.push(line);
        }
    }

    LoadModel(position, scene)
    {
        let inPlane = this.IsInPlane(this.reticle.position);

        new THREE.RGBELoader()
            .setDataType(THREE.UnsignedByteType)
            .setPath('Textures/')
            .load('lebombo_1k.hdr', function (texture) {
                defaultEnv = pmremGenerator.fromEquirectangular(texture).texture;
                texture.dispose();
                pmremGenerator.dispose();
                window.gltfLoader.setPath('3D/');
                switch (decoType)
                {
                    case DecorationTypes.Decoration:
                        if (!inPlane)
                            return;

                        window.gltfLoader.load(ModelID + ".gltf", function (gltf) {
                            let loadedScene = gltf.scene;
                            let decoration;

                            //scenes were exported with lighting so make sure to only add mesh to the scene
                            loadedScene.traverse((child) => {
                                if(child.isMesh)
                                {
                                    child.material.color = decorationColor;
                                    decoration = child.parent;
                                }
                            });

                            decoration.position.copy(position);
                            if (IsDirectionX) {
                                if (HitPlaneDirection.x < 0)
                                    decoration.rotateY(Math.PI);
                            } else {
                                if (HitPlaneDirection.z < 0)
                                    decoration.rotateY(Math.PI / 2);
                                if (HitPlaneDirection.z > 0)
                                    decoration.rotateY(-Math.PI / 2);

                            }
                            let XRTransform = new XRRigidTransform(decoration.position, decoration.orientation);
                            reticleHitTestResult.createAnchor(XRTransform, app.localReferenceSpace).then((anchor) =>
                            {
                                SpawnedDecorations.push({
                                    anchoredObject: decoration,
                                    anchor: anchor
                                });
                            });
                            scene.add(decoration);
                        });
                        break;

                    case DecorationTypes.CeilingTrim:
                        app.GenerateCeilingTrims(ModelID);
                        break;

                    case DecorationTypes.FloorTrim:
                        app.GenerateFloorTrims(ModelID);
                        break;

                    case DecorationTypes.WallTrim:
                        app.GenerateWallTrims(ModelID);
                        break;

                    case DecorationTypes.Set:
                        app.PlaceSet();
                        break;

                    case DecorationTypes.FillDecoration:
                        app.FillPlane(ModelID);
                        break;

                    case DecorationTypes.UplightTrim:
                        app.GenerateCeilingTrims(ModelID);
                        break;

                    case DecorationTypes.Doortrim:
                        app.GenerateDoorTrims(ModelID);
                        break;

                    //const shadowMesh = scene.children.find(c => c.name === 'shadowMesh');
                    //shadowMesh.position.y = SpawnedDecoration.position.y
                }
            });
    }

    PlaceSet()
    {
        //Clear previously placed trims
        app.ResetCeilingTrims();
        app.ResetWallTrims();
        app.ResetFloorTrims()

        //Iterate over IDs in SetIDs array and place correct type of object based on ID (C - SX - P)
        for(let i = 0; i < SetIDs.length; ++i)
        {
            let currID = SetIDs[i];
            if (currID.startsWith("C"))
            {
                this.GenerateCeilingTrims(currID);
            }
            if (currID.startsWith("SX"))
            {
                this.GenerateFloorTrims(currID);
            }
            if (currID.startsWith("P"))
            {
                this.GenerateWallTrims(currID);
            }
        }
    }

    GenerateTrims(ID, StartPosition, direction, absDirection,IsX, decoType)
    {
            let positionOffset = new THREE.Vector3(0,0,0);
            let nrToSpawn = 0;
            let length;
            let clipNormal;
            if (IsX)
            {
                if (direction.x > 0)
                    clipNormal = new THREE.Vector3(-1,0,0);
                else
                    clipNormal = new THREE.Vector3(-1,0,0);
            }
            else
            {
                if (direction.z > 0)
                    clipNormal = new THREE.Vector3(0,0,-1);
                else
                    clipNormal = new THREE.Vector3(0,0,1);
            }

            //Initial load so we can use data to calculate additional nr of meshes we might need to load after this
            window.gltfLoader.load(ID + ".gltf", function (gltf)
            {
                let loadedScene = gltf.scene;
                let trimToSpawn;
                if (decoType !== DecorationTypes.UplightTrim)
                {
                    loadedScene.traverse((child) => {
                        if(child.isMesh)
                        {
                            trimToSpawn = child.parent;
                        }
                    });
                }
                else
                    trimToSpawn = loadedScene;

                trimToSpawn.position.copy(StartPosition);
                let box = new THREE.Box3().setFromObject(trimToSpawn);
                let dimensions = new THREE.Vector3(0,0,0);
                box.getSize(dimensions);

                if (IsX)
                {
                    nrToSpawn = Math.ceil(absDirection.x / dimensions.x);
                    length = absDirection.x;
                    if (direction.x < 0)
                    {
                        trimToSpawn.rotateY(Math.PI);
                        positionOffset.x = -dimensions.x;
                    }
                    else
                    {
                        positionOffset.x = dimensions.x;
                    }

                }
                else
                {
                    nrToSpawn = Math.ceil(absDirection.z / dimensions.x);
                    length = absDirection.z;
                    if (direction.z < 0)
                    {
                        trimToSpawn.rotateY(Math.PI / 2)
                        positionOffset.z = -dimensions.x;
                    }
                    if (direction.z > 0)
                    {
                        trimToSpawn.rotateY(-Math.PI / 2)
                        positionOffset.z = dimensions.x;
                    }
                }

                let XRTransform = new XRRigidTransform(trimToSpawn.position, trimToSpawn.orientation);
                reticleHitTestResult.createAnchor(XRTransform, app.localReferenceSpace).then((anchor) =>
                {
                    switch (decoType)
                    {
                        case DecorationTypes.CeilingTrim:
                            SpawnedCeilingTrims.push({
                                anchoredObject: trimToSpawn,
                                anchor: anchor
                            });
                            break;

                        case DecorationTypes.FloorTrim:
                            SpawnedFloorTrims.push({
                                anchoredObject: trimToSpawn,
                                anchor: anchor
                            });
                            break;

                        case DecorationTypes.WallTrim:
                            SpawnedWallTrims.push({
                                anchoredObject: trimToSpawn,
                                anchor: anchor
                            });
                            break;
                    }
                    });

                //Decrement nr by one seeing as we already spawned one to get the data
                --nrToSpawn;

                if (nrToSpawn <= 0)
                {
                    if (IsX)
                    {
                        if (direction.x < 0)
                        {
                            trimToSpawn.position.x -= length;
                            length = 0;
                        }
                        app.ClipToLength(StartPosition.x,trimToSpawn ,length,clipNormal);
                    }

                    else
                        app.ClipToLength(StartPosition.z,trimToSpawn ,length,clipNormal);
                }
                else
                {
                    if (IsX)
                    {
                        if (direction.x < 0)
                        {
                            trimToSpawn.position.x -= dimensions.x;
                        }
                    }

                }

                if (IsX)
                    trimToSpawn.position.x += dimensions.x / 2;
                else
                    trimToSpawn.position.z += dimensions.x / 2;

                app.scene.add(trimToSpawn);

                //Now we load enough meshes to fill up top line of plane
                for(let i = 1; i <= nrToSpawn; ++i)
                {
                    window.gltfLoader.load(ID + ".gltf", function (gltf2)
                    {
                        let loadedScene = gltf2.scene;
                        let trimToSpawn2;

                        if (decoType !== DecorationTypes.UplightTrim)
                        {
                            loadedScene.traverse((child) => {
                                if(child.isMesh)
                                {
                                    trimToSpawn2 = child.parent;
                                }
                            });
                        }
                        else
                            trimToSpawn2 = loadedScene;

                        trimToSpawn2.position.copy(StartPosition);
                        if (decoType === DecorationTypes.Decoration)
                        {
                            trimToSpawn2.position.z += dimensions.y / 2;
                            trimToSpawn2.rotateX(Math.PI / 2);
                        }
                        trimToSpawn2.position.addScaledVector(positionOffset,i);
                        if (IsX)
                        {
                            if (direction.x < 0)
                            {
                                trimToSpawn2.rotateY(Math.PI);
                                trimToSpawn2.position.x -= dimensions.x / 2;
                            }
                            else
                            {
                                trimToSpawn2.position.x += dimensions.x / 2;
                            }

                        }
                        else
                        {
                            if (direction.z < 0)
                            {
                                trimToSpawn2.rotateY(Math.PI / 2)
                                trimToSpawn2.position.z -= dimensions.x / 2;
                            }
                            if (direction.z > 0)
                            {
                                trimToSpawn2.rotateY(-Math.PI / 2)
                                trimToSpawn2.position.z += dimensions.x / 2;
                            }
                        }
                        let XRTransform = new XRRigidTransform(trimToSpawn2.position, trimToSpawn2.orientation);
                        reticleHitTestResult.createAnchor(XRTransform, app.localReferenceSpace).then((anchor) =>
                        {
                            switch (decoType)
                            {
                                case DecorationTypes.CeilingTrim:
                                    SpawnedCeilingTrims.push({
                                        anchoredObject: trimToSpawn,
                                        anchor: anchor
                                    });
                                    break;

                                case DecorationTypes.FloorTrim:
                                    SpawnedFloorTrims.push({
                                        anchoredObject: trimToSpawn,
                                        anchor: anchor
                                    });
                                    break;

                                case DecorationTypes.WallTrim:
                                    SpawnedWallTrims.push({
                                        anchoredObject: trimToSpawn,
                                        anchor: anchor
                                    });
                                    break
                            }
                        });

                        if (i === nrToSpawn)
                        {
                            if (IsX)
                                app.ClipToLength(StartPosition.x,trimToSpawn2 ,length,clipNormal);
                            else
                                app.ClipToLength(StartPosition.z,trimToSpawn2 ,length,clipNormal);
                        }

                        app.scene.add(trimToSpawn2);
                    })
                }
            })
    }

    GenerateDoorTrims(ID)
    {
        //Need to load 3 trims - left,top,right
        //1 (left), 0 (top), 2 (right)
        //Mesh represents 2m so right/left should be fine top might need to clipped
        //Iterate over each door or keep it unique per door?
        //Needs direction (X or Z)
        for(let currentPlane = 0; currentPlane < DoorPlanes.length; ++currentPlane)
        {
            let currentPoints = DoorPlanes[currentPlane];

            let direction = this.CalculatePlaneDirection(currentPoints);
            let absDirection = new THREE.Vector3(0,0,0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            let IsX = absDirection.x > absDirection.z;

            window.gltfLoader.load(ID + ".gltf", function (gltf)
            {
                let leftTrim = gltf.scene;
                leftTrim.rotateZ(Math.PI / 2);
                leftTrim.position.copy(currentPoints[1]);
                app.scene.add(leftTrim);
            })

            window.gltfLoader.load(ID + ".gltf", function (gltf)
            {
                let rightTrim = gltf.scene;
                rightTrim.rotateZ(Math.PI / 2);
                rightTrim.position.copy(currentPoints[2]);
                app.scene.add(rightTrim);
            })

            window.gltfLoader.load(ID + ".gltf", function (gltf)
            {
                let topTrim = gltf.scene;
                topTrim.position.copy(currentPoints[0]);
                app.scene.add(topTrim);
            })
        }

    }

    //Ensure to change Z to Y when testing vertical planes
    FillPlane(ID)
    {
        this.ResetDecorations();
        for (let currentPlane = 0; currentPlane < WallPlanes.length; ++currentPlane)
        {
            let nrToSpawnX;
            let nrToSpawnY;
            let positionOffset = new THREE.Vector3(0,0,0);
            let length;
            let currentPoints = WallPlanes[currentPlane];
            let currentPos = new THREE.Vector3(0, 0, 0);
            let clipNormal;
            currentPos.copy(currentPoints[0]);

            //In case ceiling trims are present - make sure decorations spawn below ceiling trim
            if (SpawnedCeilingTrims.length !== 0)
            {
                let trimBox = new THREE.Box3().setFromObject(SpawnedCeilingTrims[0].anchoredObject);
                let trimdimensions = new THREE.Vector3(0, 0, 0);
                trimBox.getSize(trimdimensions);
                currentPos.y -= trimdimensions.y;
            }

            //Check direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints);
            let absDirection = new THREE.Vector3(0, 0, 0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            let IsX = absDirection.x > absDirection.z;

            //Calculate distance from top to bottom
            let Up = new THREE.Vector3(0,0,0);
            Up.copy(currentPoints[1]);
            Up.sub(currentPoints[0]);

            let YDistance = Math.abs(Up.z);

            if (SpawnedFloorTrims.length !== 0)
            {
                let trimBox = new THREE.Box3().setFromObject(SpawnedCeilingTrims[0].anchoredObject);
                let trimdimensions = new THREE.Vector3(0, 0, 0);
                trimBox.getSize(trimdimensions);

                YDistance -= trimdimensions.y;
            }

            window.gltfLoader.load(ID + ".gltf", function (gltf)
            {
                let loadedScene = gltf.scene;
                let trimToSpawn;
                loadedScene.traverse((child) =>
                {
                    if (child.isMesh)
                    {
                        child.material.color = decorationColor;
                        trimToSpawn = child.parent;
                    }
                });
                let box = new THREE.Box3().setFromObject(trimToSpawn);
                let dimensions = new THREE.Vector3(0, 0, 0);
                box.getSize(dimensions);
                currentPos.y -= dimensions.y / 2;
                trimToSpawn.position.copy(currentPos);

                nrToSpawnY = Math.floor(YDistance / dimensions.y);
                if (IsX)
                {
                    nrToSpawnX = Math.floor(absDirection.x / dimensions.x);
                    length = absDirection.x;
                    if (direction.x < 0)
                    {
                        trimToSpawn.rotateY(Math.PI);
                        positionOffset.x = -dimensions.x;
                        clipNormal = new THREE.Vector3(1,0,0);
                    }
                    else
                    {
                        positionOffset.x = dimensions.x;
                        clipNormal = new THREE.Vector3(-1,0,0);
                    }

                }
                else
                {
                    nrToSpawnX = Math.floor(absDirection.z / dimensions.x);
                    length = absDirection.z;
                    if (direction.z < 0) {
                        trimToSpawn.rotateY(Math.PI / 2)
                        positionOffset.z = -dimensions.x;
                    }
                    if (direction.z > 0) {
                        trimToSpawn.rotateY(-Math.PI / 2)
                        positionOffset.z = dimensions.x;
                    }
                }

                let XRTransform = new XRRigidTransform(trimToSpawn.position, trimToSpawn.orientation);
                reticleHitTestResult.createAnchor(XRTransform, app.localReferenceSpace).then((anchor) => {

                            SpawnedDecorations.push({
                                anchoredObject: trimToSpawn,
                                anchor: anchor
                            });
                });

                //Decrement nr by one seeing as we already spawned one to get the data
                --nrToSpawnX;
                --nrToSpawnY;

                if (IsX)
                    trimToSpawn.position.x += dimensions.x / 2;
                else
                    trimToSpawn.position.z += dimensions.x / 2;

                app.scene.add(trimToSpawn);


                //Now we load enough meshes to fill up top line of plane

                for(let currY = 0; currY < nrToSpawnY; ++currY)
                {
                    for(let currX = 0; currX <= nrToSpawnX; ++currX)
                    {
                        window.gltfLoader.load(ID + ".gltf", function (gltf2)
                        {
                            let loadedScene = gltf2.scene;
                            let trimToSpawn2;
                            loadedScene.traverse((child) => {
                                if(child.isMesh)
                                {
                                    child.material.color = decorationColor;
                                    trimToSpawn2 = child.parent;
                                }
                            });
                            trimToSpawn2.position.copy(currentPos);
                            if (currY === 0 && currX === 0 )
                            {
                                ++currX;
                            }
                            trimToSpawn2.position.addScaledVector(positionOffset,currX);
                            trimToSpawn2.position.y -= dimensions.y * currY;
                            if (IsX)
                            {
                                if (direction.x < 0)
                                {
                                    trimToSpawn2.rotateY(Math.PI);
                                    trimToSpawn2.position.x -= dimensions.x / 2;
                                }
                                else
                                {
                                    trimToSpawn2.position.x += dimensions.x / 2;
                                }

                            }
                            else
                            {
                                if (direction.z < 0)
                                {
                                    trimToSpawn2.rotateY(Math.PI / 2)
                                    trimToSpawn2.position.z -= dimensions.x / 2;
                                }
                                if (direction.z > 0)
                                {
                                    trimToSpawn2.rotateY(-Math.PI / 2)
                                    trimToSpawn2.position.z += dimensions.x / 2;
                                }
                            }
                            let XRTransform = new XRRigidTransform(trimToSpawn2.position, trimToSpawn2.orientation);
                            reticleHitTestResult.createAnchor(XRTransform, app.localReferenceSpace).then((anchor) =>
                            {
                                        SpawnedDecorations.push({
                                            anchoredObject: trimToSpawn2,
                                            anchor: anchor
                                        });
                            })

                            if (currX === nrToSpawnX)
                            {
                                app.ClipToLength(currentPoints[0].x,trimToSpawn2 ,length,clipNormal) ;
                            }

                           /** if (currY === nrToSpawnY)
                            {
                                let YClipNorm = new THREE.Vector3(0,-1,0);
                                app.ClipToLength(currentPoints[0].y,trimToSpawn2 ,YDistance,YClipNorm) ;
                            }*/

                            app.scene.add(trimToSpawn2);
                        })
                    }
                }
            })
        }
    }

    GenerateCeilingTrims(ID)
    {
        this.ResetCeilingTrims();
        for(let currentPlane = 0; currentPlane < WallPlanes.length; ++currentPlane)
        {
            let currentPoints = WallPlanes[currentPlane];

            //Check direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints);
            let absDirection = new THREE.Vector3(0,0,0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            let IsX = absDirection.x > absDirection.z;

            this.GenerateTrims(ID, currentPoints[0], direction, absDirection, IsX, DecorationTypes.CeilingTrim);
        }
    }

    GenerateFloorTrims(ID)
    {
        this.ResetFloorTrims();
        for(let currentPlane = 0; currentPlane < WallPlanes.length; ++currentPlane)
        {
            let currentPoints = WallPlanes[currentPlane];

            //Check direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints);
            let absDirection = new THREE.Vector3(0,0,0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            let IsX = absDirection.x > absDirection.z;

            this.GenerateTrims(ID, currentPoints[1], direction, absDirection, IsX, DecorationTypes.FloorTrim);
        }
    }

    //Ensure to change Z to Y when testing vertical planes
    GenerateWallTrims(ID)
    {
        this.ResetWallTrims();
        for(let currentPlane = 0; currentPlane < WallPlanes.length; ++currentPlane)
        {
            let currentPoints = WallPlanes[currentPlane];

            //Check direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints);
            let absDirection = new THREE.Vector3(0,0,0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            let IsX = absDirection.x > absDirection.z;
            let startPoint = new THREE.Vector3(0,0,0);
            startPoint.copy(currentPoints[0]);
            startPoint.y = this.reticle.position.y;

            this.GenerateTrims(ID, startPoint, direction, absDirection, IsX, DecorationTypes.WallTrim);
        }
    }

    //Ensure to change Z to Y when testing vertical planes
    IsInPlane(position)
    {
        var inside = false;
        for(var currentPlaneId = 0; currentPlaneId < WallPlanes.length;++currentPlaneId)
        {
            var highest = new THREE.Vector3(0,0,0);
            var lowest = new THREE.Vector3(0,0,0);
            var currentPoints = WallPlanes[currentPlaneId];
            highest.copy(currentPoints[0]);
            lowest.copy(currentPoints[0]);
            for(var i = 0; i < currentPoints.length; ++i)
            {
                //Calculate boundaries
                if (highest.x < currentPoints[i].x)
                    highest.x = currentPoints[i].x;

                if (highest.y < currentPoints[i].y)
                    highest.y = currentPoints[i].y;

                if (highest.z < currentPoints[i].z)
                    highest.z = currentPoints[i].z;

                if (lowest.x > currentPoints[i].x)
                    lowest.x = currentPoints[i].x;

                if (lowest.y > currentPoints[i].y)
                    lowest.y = currentPoints[i].y;

                if (lowest.z > currentPoints[i].z)
                    lowest.z = currentPoints[i].z;
            }

            //Calculate Right direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints);

            //Check if given position is within boundary
            if (IsDirectionX)
            {
                if (position.x <= highest.x && position.x >= lowest.x
                    &&position.y <= highest.y && position.y >= lowest.y)
                {
                    inside = true;
                    HitPlaneDirection = direction;
                }
            }
            else
            {
                if (position.z <= highest.z && position.z >= lowest.z
                    && position.y <= highest.y && position.y >= lowest.y)
                {
                    inside = true;
                    HitPlaneDirection = direction;
                }
            }

        }

        return inside;
    }

    CalculatePlaneDirection(plane)
    {
        let direction = new THREE.Vector3(0,0,0);
        direction.copy(plane[2]);
        direction.sub(plane[1]);

        let absDirection = new THREE.Vector3(0,0,0);
        absDirection.copy(direction);
        absDirection.x = Math.abs(absDirection.x);
        absDirection.y = Math.abs(absDirection.y);
        absDirection.z = Math.abs(absDirection.z);
        IsDirectionX = absDirection.x > absDirection.z;

        return direction;
    }

    CreateButton(text, left)
    {
        const button = document.createElement('button');

        button.style.display = '';

        button.style.cursor = 'pointer';
        button.style.left = left;
        button.style.width = '100px';
        button.textContent = text;
        this.stylizeElement(button);

        button.onmouseenter = function () {

            button.style.opacity = '1.0';

        };

        button.onmouseleave = function () {

            button.style.opacity = '0.5';

        };

        return button;
    }

    CreateDoneButton()
    {
        let left = 'calc(50% - 50px)';
        let text = 'Done';
        const button = this.CreateButton(text,left)

        button.onclick = function ()
        {
            app.DoneClicked();
        }

        document.body.appendChild(button);
        DoneButton = button;
    }

    CreateSelectDoorsButton()
    {
        let left = 'calc(85% - 50px)';
        let text = 'Select doors';
        const button = this.CreateButton(text,left)

        button.onclick = function ()
        {
            app.SelectDoorsClicked();
        }

        document.body.appendChild(button);
        DoorsButton = button;
    }

    CreatePlaceButton()
    {
        let left = 'calc(50% - 50px)';
        let text = 'Place';
        const button = this.CreateButton(text,left)

        button.onclick = function ()
        {
            app.PlaceClicked();
        }

        document.body.appendChild(button);
    }

    CreateResetButton()
    {
        let left = 'calc(85% - 50px)';
        let text = 'Reset';
        const button = this.CreateButton(text,left)

        button.onclick = function ()
        {
            app.ResetClicked();
        }

        document.body.appendChild(button);
    }

    stylizeElement( element )
    {

        element.style.position = 'absolute';
        element.style.bottom = '60px';
        element.style.padding = '12px 6px';
        element.style.border = '1px solid #fff';
        element.style.borderRadius = '4px';
        element.style.background = 'rgba(0,0,0,0.1)';
        element.style.color = '#fff';
        element.style.font = 'normal 13px sans-serif';
        element.style.textAlign = 'center';
        element.style.opacity = '0.5';
        element.style.outline = 'none';
        element.style.zIndex = '999';
    }

    PlaceClicked()
    {
        if (FinishedPlacingWalls)
        {
            if (ModelID != null)
                this.LoadModel(this.reticle.position, this.scene);
        }
    }

    ResetClicked()
    {
        this.ResetDecorations();
        this.ResetWallTrims();
        this.ResetCeilingTrims();
        this.ResetFloorTrims();
    }

    DoneClicked()
    {
        document.getElementById("OpenButton").style.display = "block";
        this.CreatePlaceButton();
        this.CreateResetButton();
        DoneButton.style.display = "none"
        DoorsButton.style.display = 'none';
        PlacingPointsDoors = false;
        this.ResetDoorPoints();

        //Set up colorPicker
        gui = new dat.GUI();

        //Manually call update so color variable gets properly initalized with the default value of the picker
        this.UpdateTrimColor();
        this.UpdateDecorationColor();

        //Set a callback so that whenever user changes a value, it calls the update
        gui.addColor(paramsTrimColor, 'trimColor').onChange(this.UpdateTrimColor);
        gui.addColor(paramsDecorationColor, 'decorationColor').onChange(this.UpdateDecorationColor);
        gui.add(paramsVisibility, 'showGuides').onChange(this.UpdateGuideVisibility);
    }

    SelectDoorsClicked()
    {
        PlacingPointsDoors = true;
        DoorsButton.style.display = 'none';
    }
}

window.app = new App();