window.gltfLoader = new THREE.GLTFLoader();
window.objectLoader = new THREE.ObjectLoader();
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
const WallPlanePoints = [];
const WallLines = [];
const WallPlanes = [];
const UsedClippingPlanesWallFrames = [];
const PlaneHelpers = [];

const WallframePoints = [];
const WallframePlanes = [];
const WallframeLines = [];

const SpawnedCeilingTrims = [];
const SpawnedFloorTrims = [];
const SpawnedWallTrims = [];
const ConnectedWallTrims = [];
const ConnectedWallframes =[];
let TrimsToMove = [];
let FrameToMove;
let FtMClippingPlanes;
const SpawnedDoorTrims = [];

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

let WallHeight = 0;

//Ensures all the dots are placed on the same Y position
let ConstrainedYPosWalls = 0;

//Second step, place points in the corners of the walls
let PlacingPointsWalls = false;
let NrOfWalls = 0;
let PlacedFirstPointWalls = false;
let TopPoint;
let BottomPoint;

let PlacingPointsWallframes = false;

//Third step, if a placed point is close enough to a previous point close off and move to next step
const MinDistance = 0.1;
let FinishedPlacingWalls = false;
//-------------------------------------------------------------------------------------------------

let ModelID;
let isMovingTrim;
let inEditMode = false;
let selectedFrame = false;
let SpawnedDecorations = [];
let HitPlaneDirection;
let IsDirectionX = false;
let CurrentFrame;
let pmremGenerator;
let all_previous_anchors = new Set();

//GUI
let defaultGui;
let transformGui;

//Default GUI parameters
let paramsWallColor = {wallColor: "#919197"}
let paramsTrimColor = {trimColor: "#919197" };
let paramsDecorationColor = {decorationColor: "#919197" };
let paramsFillPlanes = {fillPlanes: false};
let paramsVisibility = {showGuides: true};
let trimColor;
let decorationColor;

//Transform GUI parameters
let paramsWallTrimHeight = {height: 0.5};

let defaultEnv;
let stats = new Stats();
let previewLine;

//save certain buttons so we can easily keep track of them and manipulate them
let DoneButton;
let WallframesButton;
let WindowsButton;
let PlaceButton;
let ResetButton;
let MoveButton;
let SelectButton;

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
        defaultGui.hide();
        PlaceButton.style.display = "none";
        ResetButton.style.display = "none";
    }

    closeNav() {
        document.getElementById("mySidenav").style.width = "0";
        defaultGui.show();
        PlaceButton.style.display = "block";
        ResetButton.style.display = "block";

    }

    openSub(id)
    {
        if (document.getElementById(id).style.display === "none")
            document.getElementById(id).style.display = "block";
        else
            document.getElementById(id).style.display = "none";

    }

    //Separate clip function for doortrims and frames where it is important that trims get trimmed and connect to each other
    DoorClip(plane,object,clipNormal,createHelper)
    {
        //Now we transform our plane into a 2D plane so we can actually use it to clip
        var normal = new THREE.Vector3();
        var point = new THREE.Vector3();

        normal.copy(clipNormal);
        normal.applyQuaternion( plane.quaternion );
        point.copy( plane.position );
        var clipPlane =  new THREE.Plane();

        clipPlane.setFromNormalAndCoplanarPoint(normal,point);

        let clippingPlane = [clipPlane.clone()];

        if (createHelper)
        {
            let test = new THREE.PlaneHelper(clippingPlane[0],2,0x0000ff )
            this.scene.add(test);
            PlaneHelpers.push(test);
        }

        object.traverse((child) => {
            if(child.isMesh) {
                child.material = child.material.clone();
                if (child.material.clippingPlanes === null)
                    child.material.clippingPlanes = clippingPlane;

                else
                    child.material.clippingPlanes.push(clippingPlane[0]);
            }
        })
    }

    ResetHelpers()
    {
        for(let i = 0; i < PlaneHelpers.length; ++i)
        {
            this.scene.remove(PlaneHelpers[i]);
        }
        PlaneHelpers.length = 0;
    }

    ClipToLength(startPos, object, length, clipNormal, createHelper)
    {
        let clippingPlane = [new THREE.Plane(clipNormal,startPos + length)];

        if (createHelper)
        {
            let test = new THREE.PlaneHelper(clippingPlane[0],2,0x0000ff )
            this.scene.add(test);
        }

        object.traverse((child) => {
            if(child.isMesh) {
                child.material = child.material.clone();
                if (child.material.clippingPlanes === null)
                    child.material.clippingPlanes = clippingPlane;

                else
                child.material.clippingPlanes.push(clippingPlane[0]);
            }
        })
    }

    ResetClipPlanes(object)
    {
        object.traverse((child) => {
            if (child.isMesh) {
                //child.material = child.material.clone();
                if (child.material.clippingPlanes !== null)
                    child.material.clippingPlanes = null;
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
        /**stats.showPanel(0);
        stats.dom.style.left = "25px";
        stats.dom.style.top = "700px";
        document.body.appendChild(stats.dom);*/

        this.xrSession.requestAnimationFrame(this.onXRFrame);

        this.xrSession.addEventListener("select", this.onSelect);
        this.xrSession.addEventListener("selectstart", this.onSelectStart);
        this.xrSession.addEventListener("selectend", this.onSelectEnd);
        /** To help with working with 3D on the web, we'll use three.js. */
        this.setupThreeJs();

    }

    /**
     * Called on the XRSession's requestAnimationFrame.
     * Called with the time and XRPresentationFrame.
     */
    onXRFrame = (time, frame) => {
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
            if (pose.emulatedPosition === true)
                console.log('Lost tracking, using emulated position');
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
            if (PlacingPointsWalls && WallPoints.length !== 0)
            {
                this.scene.remove(previewLine);
                let PreviewPoints = [];
                let InitialPos = new THREE.Vector3(0,0,0);
                InitialPos.copy(this.reticle.position);
                InitialPos.y = ConstrainedYPosWalls;
                PreviewPoints.push(InitialPos);
                TopPoint = InitialPos;

                let adjustedPos = new THREE.Vector3(0,0,0);
                adjustedPos.copy(this.reticle.position);
                adjustedPos.y = ConstrainedYPosWalls - WallHeight;
                PreviewPoints.push(adjustedPos);
                BottomPoint = adjustedPos;

                let copiedPos1 = new THREE.Vector3(0,0,0);
                let copiedPos2 = new THREE.Vector3(0,0,0);
                let arrLength = WallPoints.length;

                copiedPos1.copy(WallPoints[arrLength - 1].position);
                copiedPos2.copy(WallPoints[arrLength - 2].position);

                let direction = new THREE.Vector3(0,0,0);
                direction.copy(BottomPoint);
                direction.sub(copiedPos1);
                let isDirectionX = Math.abs(direction.x) > Math.abs(direction.z);

                if (isDirectionX)
                {
                    TopPoint.z = copiedPos1.z;
                    BottomPoint.z = copiedPos1.z;
                }
                else
                {
                    TopPoint.x = copiedPos1.x;
                    BottomPoint.x = copiedPos1.x;
                }

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
            // Update the position of all the anchored objects based on the currently reported positions of their anchors
            const tracked_anchors = frame.trackedAnchors;
            if(tracked_anchors){
                all_previous_anchors.forEach(anchor => {
                    if(!tracked_anchors.has(anchor)){
                        this.scene.remove(anchor.sceneObject);
                    }
                });

                tracked_anchors.forEach(anchor => {
                    const anchorPose = frame.getPose(anchor.anchorSpace, this.localReferenceSpace);
                    if (anchorPose) {
                        anchor.context.sceneObject.matrix.set(anchorPose.transform.matrix);
                    } else {
                        anchor.context.sceneObject.visible = false;
                    }
                });

                all_previous_anchors = tracked_anchors;
            } else {
                all_previous_anchors.forEach(anchor => {
                    this.scene.remove(anchor.sceneObject);
                });

                all_previous_anchors = new Set();
            }


            /** Render the scene with THREE.WebGLRenderer. */
            this.renderer.render(this.scene, this.camera)
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
        directionalLight.castShadow = true;
        directionalLight.position.set(0, 1, 0.75).normalize();
        const xrLight = new XREstimatedLight(this.renderer);
        xrLight.castShadow = true;

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
        this.scene.add(this.reticle);
        this.scene.add(shadowMesh);

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
        SpawnedCeilingTrims[currTrim].traverse((child) => {
            if (child.isMesh)
            {
                child.material.color.set(trimColor);
            }
            })
        }

        for(let currTrim = 0; currTrim < SpawnedFloorTrims.length; ++currTrim)
        {
            SpawnedFloorTrims[currTrim].traverse((child) => {
                if (child.isMesh) {
                    child.material.color.set(trimColor);
                }
            })

        }

        for(let currConnectedTrim = 0; currConnectedTrim < ConnectedWallTrims.length; ++currConnectedTrim)
        {
            let trims = ConnectedWallTrims[currConnectedTrim];
            for (let currTrim = 0; currTrim < trims.length; ++currTrim)
            {
                trims[currTrim].traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(trimColor);
                    }
                })
            }

        }

        for (let currTrim = 0; currTrim < SpawnedDoorTrims.length; ++currTrim)
        {
            SpawnedDoorTrims[currTrim].traverse((child) => {
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
            SpawnedDecorations[currTrim].traverse((child) => {
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
                WallPoints[currentPoint].visible = isActive;
            }

            for (let currentLine = 0; currentLine < WallLines.length; ++currentLine)
            {
                WallLines[currentLine].visible = isActive;
            }
    }

    UpdatePlaneFill()
    {
        for (let currentPlane = 0; currentPlane < WallPlanes.length; ++currentPlane)
        {
            WallPlanes[currentPlane].visible = paramsFillPlanes.fillPlanes;
        }
    }

    UpdateWallColor()
    {
        let WallColor = new THREE.Color(paramsWallColor.wallColor);

        for (let i = 0; i < WallPlanes.length; ++i)
        {
            WallPlanes[i].material.color.set(WallColor);
        }
    }

    /** Place a point when the screen is tapped.
     * Once 2 or more points have been placed create lines*/
        //Ensure to change Z to Y when testing vertical planes
    onSelect = (event) =>
    {
        console.log("Select triggered")
        if (!FinishedPlacingWalls)
            this.HandleWallSelection(event);

        if (PlacingPointsWallframes)
            this.HandleWallframeSelection(event);
    }

    onSelectStart = (event) =>
    {
        console.log("Select start triggered")

        if (inEditMode)
        {
            for (let i = 0; i < SpawnedWallTrims.length; ++i)
            {
                let distanceToMarker = SpawnedWallTrims[i].position.distanceToSquared(this.reticle.position);
                if (distanceToMarker < MinDistance)
                {
                    isMovingTrim = true;
                }
            }
        }
    }

    onSelectEnd = (event) =>
    {
        console.log("Select end triggered")
        isMovingTrim = false;
    }

    HandleWallSelection(event)
    {
        if (PlacingPointsWalls)
        {
                if (WallPoints.length !== 0)
                {
                    let distanceToMarker = WallPoints[WallPoints.length - 1].position.distanceToSquared(this.reticle.position);
                    if (distanceToMarker < MinDistance)
                    {
                        FinishedPlacingWalls = true;
                        PlacingPointsWalls = false;
                        this.scene.remove(previewLine);
                        previewLine = null;
                        this.CreatePlanes();
                        this.CreateDoneButton();
                        this.CreateSelectWallframesButton();
                        document.getElementById("WallsIcon").style.display = "none";
                    }

                    distanceToMarker = WallPoints[1].position.distanceToSquared(this.reticle.position);
                    if (distanceToMarker < MinDistance)
                    {
                        let Point1;
                        let FirstLocation = new THREE.Vector3(0,0,0);
                        FirstLocation.copy(TopPoint);
                        Point1 = this.CreateSphere(FirstLocation);

                        let SecondLocation = new THREE.Vector3(0,0,0);
                        SecondLocation.copy(FirstLocation);
                        SecondLocation.y = ConstrainedYPosWalls - WallHeight;
                        let Point2 = this.CreateSphere(SecondLocation);

                        //Code copied from anchor example https://github.com/immersive-web/webxr-samples/blob/main/anchors.html
                        let frame = event.frame;
                        let anchorPose = new XRRigidTransform();
                        let inputSource = event.inputSource;

                        // If the user is on a screen based device, place the anchor 1 meter in front of them.
                        // Otherwise place the anchor at the location of the input device
                        if (inputSource.targetRayMode === 'screen') {
                            anchorPose = new XRRigidTransform(
                                {x: 0, y: 0, z: -1},
                                {x: 0, y: 0, z: 0, w: 1});
                        }

                        // Create a free-floating anchor.
                        frame.createAnchor(anchorPose, this.localReferenceSpace).then((anchor) => {
                            anchor.context = {};
                            anchor.context.sceneObject = Point1;
                            Point1.anchor = anchor;
                            WallPoints.push(Point1);
                        })

                        frame.createAnchor(anchorPose, this.localReferenceSpace).then((anchor) => {
                            anchor.context = {};
                            anchor.context.sceneObject = Point2;
                            Point2.anchor = anchor;
                            WallPoints.push(Point2);

                            if (WallPoints.length >= 4)
                            {
                                ++NrOfWalls;
                            }
                            this.CreatePlanes();
                            this.CreateDoneButton();
                            this.CreateSelectWallframesButton();
                            document.getElementById("WallsIcon").style.display = "none";
                        })
                        FinishedPlacingWalls = true;
                        PlacingPointsWalls = false;
                        let test = previewLine.clone();
                        this.scene.remove(previewLine);
                        this.scene.add(test);
                        WallLines.push(test);
                        previewLine = null;

                    }
                }

                let Point1;
                let Point2;
                let FirstLocation = new THREE.Vector3(0,0,0);
                FirstLocation.copy(this.reticle.position);
                FirstLocation.y = ConstrainedYPosWalls;

                //Used to ensure that the else code doesn't execute when placing first point
                if (!PlacedFirstPointWalls)
                {
                    PlacedFirstPointWalls = true;
                }


                if (TopPoint)
                    Point1 = this.CreateSphere(TopPoint);
                else
                    Point1 = this.CreateSphere(FirstLocation);

                //Code copied from anchor example https://github.com/immersive-web/webxr-samples/blob/main/anchors.html
                let frame = event.frame;
                let anchorPose = new XRRigidTransform();
                let inputSource = event.inputSource;

                // If the user is on a screen based device, place the anchor 1 meter in front of them.
                // Otherwise place the anchor at the location of the input device
                if (inputSource.targetRayMode === 'screen') {
                    anchorPose = new XRRigidTransform(
                        {x: 0, y: 0, z: -1},
                        {x: 0, y: 0, z: 0, w: 1});
                }

                // Create a free-floating anchor.
                frame.createAnchor(anchorPose, this.localReferenceSpace).then((anchor) => {
                    anchor.context = {};
                    anchor.context.sceneObject = Point1;
                    Point1.anchor = anchor;
                    WallPoints.push(Point1);
                })


                let SecondLocation = new THREE.Vector3(0,0,0);
                SecondLocation.copy(FirstLocation);
                SecondLocation.y = ConstrainedYPosWalls - WallHeight;

                if (BottomPoint)
                 Point2 = this.CreateSphere(BottomPoint);
                else
                    Point2 = this.CreateSphere(SecondLocation);

                // Create a free-floating anchor.
                frame.createAnchor(anchorPose, this.localReferenceSpace).then((anchor) => {
                    anchor.context = {};
                    anchor.context.sceneObject = Point2;
                    Point2.anchor = anchor;
                    WallPoints.push(Point2);

                    if (WallPoints.length >= 4)
                    {
                        ++NrOfWalls;
                    }
                })



                if (WallPoints.length > 0)
                {
                    let test = previewLine.clone();
                    this.scene.remove(previewLine);
                    this.scene.add(test);
                    WallLines.push(test);
                    previewLine = null;
                }
        }

        if (IsDeterminingHeightWalls)
        {
            let createdSphere = this.CreateSphere(this.reticle.position);

                // Create a free-floating anchor.
                reticleHitTestResult.createAnchor().then((anchor) =>
                {
                    anchor.context = {};
                    anchor.context.sceneObject = createdSphere;
                    createdSphere.anchor = anchor;

                    WallPoints.push(createdSphere);

                    if (WallPoints.length === 2)
                    {
                        ConstrainedYPosWalls = WallPoints[1].position.y;

                        //DELETE - Just added it now for testing purposes
                        ConstrainedYPosWalls = 2;

                        WallHeight = ConstrainedYPosWalls - WallPoints[0].position.y;
                        this.ResetWallPoints();
                        IsDeterminingHeightWalls = false;
                        PlacingPointsWalls = true;
                        document.getElementById("HeightIcon").style.display = "none";
                        document.getElementById("WallsIcon").style.display = "block";
                    }

                }, (error) => {
                    console.error("Could not create anchor: " + error);
                });
        }
    }

    HandleWallframeSelection(event)
    {
            //Select bottom left - top right
            let createdSphere = this.CreateSphere(this.reticle.position);

            //Code copied from anchor example https://github.com/immersive-web/webxr-samples/blob/main/anchors.html
            let frame = event.frame;
            let anchorPose = new XRRigidTransform();
            let inputSource = event.inputSource;

            // If the user is on a screen based device, place the anchor 1 meter in front of them.
            // Otherwise place the anchor at the location of the input device
            if (inputSource.targetRayMode === 'screen') {
                anchorPose = new XRRigidTransform(
                    {x: 0, y: 0, z: -1},
                    {x: 0, y: 0, z: 0, w: 1});
            }

            // Create a free-floating anchor.
            frame.createAnchor(anchorPose, this.localReferenceSpace).then((anchor) => {
                anchor.context = {};
                anchor.context.sceneObject = createdSphere;
                createdSphere.anchor = anchor;
                WallframePoints.push(createdSphere);

                if (WallframePoints.length === 2)
                {
                    //Generate top left
                    WallframePoints[1].position.y = 0.5;
                    let topLeftPosition = WallframePoints[0].position.clone();
                    topLeftPosition.y = WallframePoints[1].position.y;
                    let topLeftSphere = this.CreateSphere(topLeftPosition);
                    WallframePoints.push(topLeftSphere);

                    //Generate bottom right
                    let bottomRightPosition = WallframePoints[1].position.clone();
                    bottomRightPosition.y = WallframePoints[0].position.y;
                    let bottomRightSphere = this.CreateSphere(bottomRightPosition);
                    WallframePoints.push(bottomRightSphere);

                    this.DrawDoor();
                }
            })
    }

    HandleWindowSelection()
    {
        
    }

    ResetWallPoints()
    {
        for(let i= 0; i < WallPoints.length; ++i)
        {
            this.scene.remove(WallPoints[i]);
            WallPoints[i].anchor.delete();
        }
        WallPoints.length = 0;
    }

    ResetWallframePoints()
    {
        for(let i= 0; i < WallframePoints.length; ++i)
        {
            this.scene.remove(WallframePoints[i]);
            if (WallframePoints[i].anchor)
                WallframePoints[i].anchor.delete();
        }
        WallframePoints.length = 0;
    }

    ResetDoorTrims()
    {
        for (let i = 0 ; i < SpawnedDoorTrims.length; ++i)
        {
            this.scene.remove(SpawnedDoorTrims[i]);
        }
        SpawnedDoorTrims.length = 0;
    }

    ResetCeilingTrims()
    {
        for(let i= 0; i < SpawnedCeilingTrims.length; ++i)
        {
            this.scene.remove(SpawnedCeilingTrims[i]);
        }
        SpawnedCeilingTrims.length = 0;
    }

    ResetFloorTrims()
    {
        for(let i= 0; i < SpawnedFloorTrims.length; ++i)
        {
            this.scene.remove(SpawnedFloorTrims[i]);
        }
        SpawnedFloorTrims.length = 0;
    }

    ResetWallTrims()
    {
        for(let i= 0; i < ConnectedWallTrims.length; ++i)
        {
            let currTrimLine = ConnectedWallTrims[i];
            for (let j = 0; j < currTrimLine.length; ++j)
            {
                this.scene.remove(currTrimLine[j]);
            }
        }
        ConnectedWallTrims.length = 0;
    }

    MoveWallTrims()
    {
        if (!selectedFrame)
        {
            for (let i = 0; i < TrimsToMove.length; ++i)
            {
                TrimsToMove[i].position.y = paramsWallTrimHeight.height;
            }
        }

        else
        {
            app.ResetHelpers();
            let change = paramsWallTrimHeight.height - FrameToMove.position.y;
            FrameToMove.position.y = paramsWallTrimHeight.height;
            for (let i = 0; i < FrameToMove.children.length; ++i)
            {
                app.ResetClipPlanes(FrameToMove.children[i]);
            }
            for (let i = 0; i < FtMClippingPlanes.children.length; ++i)
            {
                FtMClippingPlanes.children[i].position.y += change;
            }
            app.ReclipFrame(FrameToMove,FtMClippingPlanes);
        }

    }

    ResetDecorations()
    {
        for(let i= 0; i < SpawnedDecorations.length; ++i)
        {
            this.scene.remove(SpawnedDecorations[i]);
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
            planePoints.push(WallPoints[startIndex].position);
            planePoints.push(WallPoints[startIndex + 1].position)
            planePoints.push(WallPoints[startIndex + 3].position)
            planePoints.push(WallPoints[startIndex + 2].position)
            WallPlanePoints.push(planePoints);
            let right = this.CalculatePlaneDirection(planePoints[1],planePoints[2])
            let up = this.CalculatePlaneDirection(planePoints[1],planePoints[0]);
            let width;
            let IsX;
            IsX = Math.abs(right.x) > Math.abs(right.z)
            if (IsX)
                width = Math.abs(right.x);
            else
                width = Math.abs(right.z);


            const geometry = new THREE.PlaneGeometry(width,up.y);

            const material = new THREE.MeshBasicMaterial( {color: 0xff0000, side: THREE.DoubleSide} );
            const plane = new THREE.Mesh( geometry, material );
            plane.position.copy(planePoints[1]);
            if (IsX)
            {
                if(right.x < 0)
                    plane.position.x -= width / 2;
                else
                    plane.position.x += width / 2;
            }

            else
            {
                plane.rotateY(Math.PI / 2);
                if (right.z < 0)
                    plane.position.z -= width / 2;
                else
                    plane.position.z += width / 2;
            }

            plane.position.y += up.y / 2;
            plane.visible = false;
            this.scene.add( plane );
            WallPlanes.push(plane);

            startIndex += 2;
        }

    }

    DrawDoor()
    {
        var linePoints = [];
        linePoints.push(WallframePoints[2].position.clone());
        linePoints.push(WallframePoints[0].position.clone());
        linePoints.push(WallframePoints[3].position.clone());
        linePoints.push(WallframePoints[1].position.clone());
        linePoints.push(WallframePoints[2].position.clone());

        const material = new THREE.LineBasicMaterial({color: 0xff0000});
        const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const line = new THREE.Line(geometry,material);
        this.scene.add(line);
        WallframeLines.push(line);
        WallframePlanes.push(linePoints);
        this.ResetWallframePoints();
    }

    DrawPlanes()
    {
        for(let i = 0; i < WallPlanePoints.length; ++i)
        {
            var Points = WallPlanePoints[i];
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
                        app.GenerateWallframeTrims(ModelID);
                        break;
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

    GenerateTrims(Trim, StartPosition, direction, absDirection,IsX, decoType)
    {
            let positionOffset = new THREE.Vector3(0,0,0);
            let nrToSpawn = 0;
            let length;
            let clipNormal;
            if (IsX)
                clipNormal = new THREE.Vector3(-1,0,0);
            else
                clipNormal = new THREE.Vector3(0,0,-1);

            //Initial load so we can use data to calculate additional nr of meshes we might need to load after this
                let trimToSpawn = Trim.clone();

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
                        positionOffset.x = dimensions.x;
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
                        positionOffset.z = dimensions.x;
                    }
                    if (direction.z > 0)
                    {
                        trimToSpawn.rotateY(-Math.PI / 2)
                        positionOffset.z = dimensions.x;
                    }
                }

                    switch (decoType)
                    {
                        case DecorationTypes.CeilingTrim:
                            SpawnedCeilingTrims.push(trimToSpawn);
                            break;

                        case DecorationTypes.FloorTrim:
                            SpawnedFloorTrims.push(trimToSpawn);
                            break;

                        case DecorationTypes.WallTrim:
                            SpawnedWallTrims.push(trimToSpawn);
                            break;
                    }

                //Decrement nr by one seeing as we already spawned one to get the data
                --nrToSpawn;

                if (nrToSpawn <= 0)
                {
                    if (IsX)
                    {
                        app.ClipToLength(StartPosition.x,trimToSpawn ,length,clipNormal,false);
                    }
                    else
                    {
                        app.ClipToLength(StartPosition.z,trimToSpawn ,length,clipNormal,false);
                    }

                }

                if (IsX)
                    trimToSpawn.position.x += dimensions.x / 2;
                else
                    trimToSpawn.position.z += dimensions.x / 2;

                app.scene.add(trimToSpawn);

                //Now we clone enough meshes to fill up top line of plane
                for(let i = 1; i <= nrToSpawn; ++i)
                {
                        let trimToSpawn2 = Trim.clone();

                        trimToSpawn2.position.copy(StartPosition);

                        trimToSpawn2.position.addScaledVector(positionOffset,i);
                        if (IsX)
                        {
                            if (direction.x < 0)
                            {
                                trimToSpawn2.rotateY(Math.PI);
                                trimToSpawn2.position.x += dimensions.x / 2;
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
                                trimToSpawn2.position.z += dimensions.x / 2;
                            }
                            if (direction.z > 0)
                            {
                                trimToSpawn2.rotateY(-Math.PI / 2)
                                trimToSpawn2.position.z += dimensions.x / 2;
                            }
                        }

                            switch (decoType)
                            {
                                case DecorationTypes.CeilingTrim:
                                    SpawnedCeilingTrims.push(trimToSpawn2);
                                    break;

                                case DecorationTypes.FloorTrim:
                                    SpawnedFloorTrims.push(trimToSpawn2);
                                    break;

                                case DecorationTypes.WallTrim:
                                    SpawnedWallTrims.push(trimToSpawn2);
                                    break;
                            }

                        if (i === nrToSpawn)
                        {
                            if (IsX)
                            {
                                if (direction.x < 0)
                                {
                                   app.ClipToLength(StartPosition.x ,trimToSpawn2 ,length,clipNormal,false);
                                }

                                else
                                    app.ClipToLength(StartPosition.x,trimToSpawn2 ,length,clipNormal,false);
                            }

                            else
                            {
                                if (direction.z < 0)
                                {
                                    app.ClipToLength(StartPosition.z,trimToSpawn2 ,length,clipNormal,false);
                                }
                                else
                                    app.ClipToLength(StartPosition.z,trimToSpawn2 ,length,clipNormal,false);
                            }
                        }
                        app.scene.add(trimToSpawn2);
                }
    }

    GenerateSlicedTrims(loadedMesh, planes,isDoors)
    {
        //Need to load 3 trims - left,top,right
        //1 (left), 0 (top), 2 (right)
        //Iterate over each door or keep it unique per door?
        //Needs direction (X or Z)
        for(let currentPlane = 0; currentPlane < planes.length; ++currentPlane)
        {
            let currentPoints = planes[currentPlane];
            let usedClippingPlanes = new THREE.Group();
            let trims = new THREE.Group();

            let rightDirection = this.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);
            let absRightDirection = new THREE.Vector3(0,0,0);
            absRightDirection.copy(rightDirection);
            absRightDirection.x = Math.abs(absRightDirection.x);
            absRightDirection.y = Math.abs(absRightDirection.y);
            absRightDirection.z = Math.abs(absRightDirection.z);
            let IsX = absRightDirection.x > absRightDirection.z;
            let box;
            let length;
            let dimensions = new THREE.Vector3(0,0,0);

            //Load left trim and get dimensions

                //Create 3D plane in order to make positioning easier
                let testPlaneGeom = new THREE.PlaneGeometry(1,1);
                const material = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide} );
                const LTPlane = new THREE.Mesh( testPlaneGeom, material );
                const LBPlane = new THREE.Mesh(testPlaneGeom,material);

                LTPlane.position.copy(currentPoints[0]);
                LBPlane.position.copy(currentPoints[1]);
                if (IsX)
                {
                    if (rightDirection.x < 0)
                    {
                        LTPlane.rotateY(Math.PI);
                        LBPlane.rotateY(Math.PI);
                    }
                    LTPlane.rotateZ(-Math.PI / 4);
                    LBPlane.rotateZ(Math.PI / 4);


                }
                else
                {
                    if (rightDirection.z < 0)
                    {
                        LTPlane.rotateY(Math.PI);
                        LBPlane.rotateY(Math.PI);
                    }
                        LTPlane.rotateX(Math.PI / 4);
                        LBPlane.rotateX(-Math.PI / 4);

                }
                usedClippingPlanes.add(LTPlane);
                usedClippingPlanes.add(LBPlane);


                let leftTrim = loadedMesh.clone();
                box = new THREE.Box3().setFromObject(leftTrim);
                box.getSize(dimensions);
                leftTrim.rotateZ(-Math.PI / 2);

                leftTrim.position.copy(currentPoints[1]);
                if (IsX)
                {
                    length = absRightDirection.x;
                    if (rightDirection.x < 0)
                    {
                        leftTrim.rotateX(Math.PI);
                    }
                }
                else
                {
                    length = absRightDirection.z;
                    if (rightDirection.z < 0)
                    {
                        leftTrim.rotateX(-Math.PI / 2);
                    }

                    else
                    {
                        leftTrim.rotateX(Math.PI / 2);
                    }
                }


                leftTrim.position.y += dimensions.x / 2;

                let YClip = new THREE.Vector3(0,-1,0);
                let posYClip = new THREE.Vector3(0,1,0);
                app.DoorClip(LTPlane,leftTrim,YClip,false);

                if (!isDoors)
                    app.DoorClip(LBPlane,leftTrim,posYClip,false);

                trims.add(leftTrim);
                //app.scene.add(leftTrim);

            //Load right trim

                //Create 3D plane in order to make positioning easier
                const RTPlane = new THREE.Mesh( testPlaneGeom, material );
                const RBPlane = new THREE.Mesh(testPlaneGeom,material);

                RTPlane.position.copy(currentPoints[3]);
                RBPlane.position.copy(currentPoints[2]);
                if (IsX)
                {
                    if (rightDirection.x < 0)
                    {
                        RTPlane.rotateY(Math.PI);
                        RBPlane.rotateY(Math.PI)
                    }

                    RTPlane.rotateZ(Math.PI / 4);
                    RBPlane.rotateZ(-Math.PI / 4);
                }
                else
                {
                    if (rightDirection.z < 0)
                    {
                        RTPlane.rotateY(Math.PI);
                        RBPlane.rotateY(Math.PI)
                    }

                    RTPlane.rotateX(-Math.PI / 4);
                    RBPlane.rotateX(Math.PI / 4);

                }
                usedClippingPlanes.add(RTPlane);
                usedClippingPlanes.add(RBPlane);

                let rightTrim = loadedMesh.clone();
                rightTrim.rotateZ(Math.PI / 2);

                if (IsX)
                {
                    if (rightDirection.x < 0)
                        rightTrim.rotateX(Math.PI);
                }
                else
                {
                    if (rightDirection.z < 0)
                        rightTrim.rotateX(Math.PI / 2);
                    else
                        rightTrim.rotateX(-Math.PI / 2);
                }

                rightTrim.position.copy(currentPoints[2]);
                rightTrim.position.y += dimensions.x / 2;
                app.DoorClip(RTPlane,rightTrim,YClip,false);

                if (!isDoors)
                    app.DoorClip(RBPlane,rightTrim,posYClip,false);

                trims.add(rightTrim);
                //app.scene.add(rightTrim);

            //Load top trim
                let topTrim = loadedMesh.clone();
                topTrim.position.copy(currentPoints[0]);
                if (IsX)
                {
                    if (rightDirection.x < 0)
                    {
                        topTrim.position.copy(currentPoints[3]);
                        topTrim.rotateX(Math.PI);
                    }
                    else
                        topTrim.position.y -= dimensions.y;


                    topTrim.position.x += dimensions.x / 2;
                    app.DoorClip(LTPlane,topTrim,posYClip,false)
                    app.DoorClip(RTPlane,topTrim,posYClip,false);
                }
                else
                {
                    if (rightDirection.z < 0)
                    {
                        topTrim.position.copy(currentPoints[3]);
                        topTrim.rotateY(Math.PI / 2);
                    }

                    else
                        topTrim.rotateY(-Math.PI/2);
                    topTrim.position.z += dimensions.x / 2;
                    topTrim.position.y -= dimensions.y;
                    app.DoorClip(LTPlane,topTrim,posYClip,false)
                    app.DoorClip(RTPlane,topTrim,posYClip,false);
                }
                trims.add(topTrim);
                //app.scene.add(topTrim);

                if (!isDoors)
                {
                    //Load bottom trim
                    let bottomTrim = loadedMesh.clone();
                    bottomTrim.position.copy(currentPoints[1]);

                    if (IsX)
                    {
                        if (rightDirection.x < 0)
                        {
                            bottomTrim.position.copy(currentPoints[2]);
                            bottomTrim.position.y += dimensions.y;
                            bottomTrim.rotateX(Math.PI);
                        }
                        bottomTrim.position.x += dimensions.x / 2;
                        app.DoorClip(LBPlane,bottomTrim,YClip,false);
                        app.DoorClip(RBPlane,bottomTrim,YClip,false);
                    }
                    else
                    {
                        if (rightDirection.z < 0)
                        {
                            bottomTrim.position.copy(currentPoints[2]);
                            bottomTrim.rotateY(Math.PI / 2);
                        }
                        else
                        {
                            bottomTrim.rotateY(-Math.PI/2);
                        }
                        bottomTrim.position.z += dimensions.x / 2;
                        app.DoorClip(LBPlane,bottomTrim,YClip,false);
                        app.DoorClip(RBPlane,bottomTrim,YClip,false);

                    }
                    trims.add(bottomTrim);
                    //app.scene.add(bottomTrim);
                }
                UsedClippingPlanesWallFrames.push(usedClippingPlanes);
                app.scene.add(trims);
                ConnectedWallframes.push(trims);
        }

    }

    GenerateWallframeTrims(ID)
    {
        window.gltfLoader.load(ID + ".gltf", function (gltf) {
            let loadedScene = gltf.scene;
            let defaultTrim;
            loadedScene.traverse((child) => {
                if (child.isMesh) {
                    child.material.color.set(trimColor);
                    defaultTrim = child.parent;
                }
            });
            let testGroup = new THREE.Group;
            app.GenerateSlicedTrims(defaultTrim,WallframePlanes,false);
        })
    }

    ReclipFrame(trims, clippingPlanes)
    {
        let NegYClip = new THREE.Vector3(0,-1,0);
        let PosYClip = new THREE.Vector3(0,1,0);

        //Reclip left trim
        this.DoorClip(clippingPlanes.children[0],trims.children[0],NegYClip,false);
        this.DoorClip(clippingPlanes.children[1],trims.children[0],PosYClip,false);

        //Reclip right trim
        this.DoorClip(clippingPlanes.children[2],trims.children[1],NegYClip,false);
        this.DoorClip(clippingPlanes.children[3],trims.children[1],PosYClip,false);

        //Reclip top trim
        this.DoorClip(clippingPlanes.children[0],trims.children[2],PosYClip,false);
        this.DoorClip(clippingPlanes.children[2],trims.children[2],PosYClip,false);

        //Reclip bottom trim
        this.DoorClip(clippingPlanes.children[1],trims.children[3],NegYClip,false);
        this.DoorClip(clippingPlanes.children[3],trims.children[3],NegYClip,false);
    }

    //Ensure to change Z to Y when testing vertical planes
    FillPlane(ID)
    {
        for (let currentPlane = 0; currentPlane < WallPlanePoints.length; ++currentPlane)
        {
            let currentPoints = WallPlanePoints[currentPlane];

            if (!this.IsInSpecificPlane(this.reticle.position,currentPoints))
                continue;

            let nrToSpawnX;
            let nrToSpawnY;
            let positionOffset = new THREE.Vector3(0,0,0);
            let length;
            let currentPos = new THREE.Vector3(0, 0, 0);
            let clipNormal;
            currentPos.copy(currentPoints[0]);

            //In case ceiling trims are present - make sure decorations spawn below ceiling trim
            if (SpawnedCeilingTrims.length !== 0)
            {
                let trimBox = new THREE.Box3().setFromObject(SpawnedCeilingTrims[0]);
                let trimdimensions = new THREE.Vector3(0, 0, 0);
                trimBox.getSize(trimdimensions);
                currentPos.y -= trimdimensions.y;
            }

            //Check direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);
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

            let YDistance = Math.abs(Up.y);

            if (SpawnedFloorTrims.length !== 0)
            {
                let trimBox = new THREE.Box3().setFromObject(SpawnedCeilingTrims[0]);
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

                SpawnedDecorations.push(trimToSpawn)

                //Decrement nr by one seeing as we already spawned one to get the data
                --nrToSpawnX;

                if (IsX)
                {
                    if (direction.x < 0)
                    {
                        trimToSpawn.position.x -= dimensions.x;
                    }
                }
                else if (direction.z < 0)
                    trimToSpawn.position.z -= dimensions.x;

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
                            let trimToSpawn2 = trimToSpawn.clone();
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
                                    trimToSpawn2.position.z -= dimensions.x / 2;
                                }
                                if (direction.z > 0)
                                {
                                    trimToSpawn2.position.z += dimensions.x / 2;
                                }
                            }

                            SpawnedDecorations.push(trimToSpawn2);
                            app.scene.add(trimToSpawn2);
                    }
                }
            })
        }
    }

    GenerateCeilingTrims(ID)
    {
        this.ResetCeilingTrims();
        window.gltfLoader.load(ID + ".gltf", function (gltf) {
            let loadedScene = gltf.scene;
            let trimToSpawn;
            if (decoType !== DecorationTypes.UplightTrim) {
                loadedScene.traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(trimColor);
                        trimToSpawn = child.parent;
                    }
                });
            } else
                trimToSpawn = loadedScene;

            for(let currentPlane = 0; currentPlane < WallPlanePoints.length; ++currentPlane)
            {
                let currentPoints = WallPlanePoints[currentPlane];

                //Check direction of plane
                let direction = app.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);
                let absDirection = new THREE.Vector3(0,0,0);
                absDirection.copy(direction);
                absDirection.x = Math.abs(absDirection.x);
                absDirection.y = Math.abs(absDirection.y);
                absDirection.z = Math.abs(absDirection.z);
                let IsX = absDirection.x > absDirection.z;

                let startPosition = currentPoints[0];
                if (IsX)
                {
                    if (direction.x < 0)
                        startPosition = currentPoints[3];
                }
                else
                {
                    if (direction.z < 0)
                        startPosition = currentPoints[3];
                }

                app.GenerateTrims(trimToSpawn,startPosition, direction, absDirection, IsX, DecorationTypes.CeilingTrim);
            }
        })

    }

    GenerateFloorTrims(ID)
    {
        this.ResetFloorTrims();

        window.gltfLoader.load(ID + ".gltf", function (gltf) {
            let loadedScene = gltf.scene;
            let trimToSpawn;
            if (decoType !== DecorationTypes.UplightTrim) {
                loadedScene.traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(trimColor);
                        trimToSpawn = child.parent;
                    }
                });
            } else
                trimToSpawn = loadedScene;

            for(let currentPlane = 0; currentPlane < WallPlanePoints.length; ++currentPlane)
            {
                let currentPoints = WallPlanePoints[currentPlane];

                //Check direction of plane
                let direction = app.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);
                let absDirection = new THREE.Vector3(0,0,0);
                absDirection.copy(direction);
                absDirection.x = Math.abs(absDirection.x);
                absDirection.y = Math.abs(absDirection.y);
                absDirection.z = Math.abs(absDirection.z);
                let IsX = absDirection.x > absDirection.z;

                let startPosition = currentPoints[1];
                if (IsX)
                {
                    if (direction.x < 0)
                        startPosition = currentPoints[2];
                }
                else
                {
                    if (direction.z < 0)
                        startPosition = currentPoints[2];
                }

                app.GenerateTrims(trimToSpawn, startPosition, direction, absDirection, IsX, DecorationTypes.FloorTrim);
            }
        })


    }

    //Ensure to change Z to Y when testing vertical planes
    GenerateWallTrims(ID)
    {
        //this.ResetWallTrims();

        window.gltfLoader.load(ID + ".gltf", function (gltf) {
            let loadedScene = gltf.scene;
            let trimToSpawn;
            if (decoType !== DecorationTypes.UplightTrim) {
                loadedScene.traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(trimColor);
                        trimToSpawn = child.parent;
                    }
                });
            } else
                trimToSpawn = loadedScene;


            for(let currentPlane = 0; currentPlane < WallPlanePoints.length; ++currentPlane)
            {
                let currentPoints = WallPlanePoints[currentPlane];

                //Check direction of plane
                let direction = app.CalculatePlaneDirection(currentPoints[1], currentPoints[2]);
                let absDirection = new THREE.Vector3(0,0,0);
                absDirection.copy(direction);
                absDirection.x = Math.abs(absDirection.x);
                absDirection.y = Math.abs(absDirection.y);
                absDirection.z = Math.abs(absDirection.z);
                let IsX = absDirection.x > absDirection.z;
                let startPosition = currentPoints[1];
                if (IsX)
                {
                    if (direction.x < 0)
                        startPosition = currentPoints[3];
                }
                else
                {
                    if (direction.z < 0)
                        startPosition = currentPoints[3];
                }


                let startPoint = new THREE.Vector3(0,0,0);

                startPoint.copy(startPosition);
                //startPoint.y = this.reticle.position.y;

                app.GenerateTrims(trimToSpawn, startPoint, direction, absDirection, IsX, DecorationTypes.WallTrim);
            }

            ConnectedWallTrims.push([...SpawnedWallTrims]);
            SpawnedWallTrims.length = 0;
        })
    }

    //Ensure to change Z to Y when testing vertical planes
    IsInPlane(position)
    {
        var inside = false;
        for(var currentPlaneId = 0; currentPlaneId < WallPlanePoints.length;++currentPlaneId)
        {
             inside = this.IsInSpecificPlane(position,WallPlanePoints[currentPlaneId]);
             if (inside)
                 return inside;
        }

        return inside;
    }

    IsInSpecificPlane(position,planePoints)
    {
        var inside = false;
            var highest = new THREE.Vector3(0,0,0);
            var lowest = new THREE.Vector3(0,0,0);
            var currentPoints = planePoints;
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
            let direction = this.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);

            //Check if given position is within boundary
            if (IsDirectionX)
            {
                if (position.x <= highest.x && position.x >= lowest.x
                    &&position.y <= highest.y && position.y >= lowest.y)
                {
                    let distanceToMarker = Math.abs(currentPoints[0].z - this.reticle.position.z);
                    if (distanceToMarker < 0.1)
                    {
                        inside = true;
                        HitPlaneDirection = direction;
                    }
                }
            }
            else
            {
                if (position.z <= highest.z && position.z >= lowest.z
                    && position.y <= highest.y && position.y >= lowest.y)
                {
                    let distanceToMarker = Math.abs(currentPoints[0].x - this.reticle.position.x);
                    if (distanceToMarker < 0.1)
                    {
                        inside = true;
                        HitPlaneDirection = direction;
                    }
                }
            }

        return inside;
    }

    CalculatePlaneDirection(startPos, endPos)
    {
        let direction = new THREE.Vector3(0,0,0);
        direction.copy(endPos);
        direction.sub(startPos);

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

    CreateSelectWallframesButton()
    {
        let left = 'calc(85% - 50px)';
        let text = 'Select wallframes';
        const button = this.CreateButton(text,left)

        button.onclick = function ()
        {
            app.SelectWallframesClicked();
        }

        document.body.appendChild(button);
        WallframesButton = button;
    }

    CreateSelectWindowsButton()
    {
        let left = 'calc(25% - 50px)';
        let text = 'Select windows';
        const button = this.CreateButton(text,left)

        button.onclick = function ()
        {

        }

        document.body.appendChild(button);
        WallframesButton = button;
    }

    CreatePlaceButton()
    {
        let left = 'calc(50% - 50px)';
        let text = 'Place';
        PlaceButton = this.CreateButton(text,left);

        PlaceButton.onclick = function ()
        {
            app.PlaceClicked();
        }

        document.body.appendChild(PlaceButton);
    }

    CreateEditButton()
    {
        let left = 'calc(20% - 50px)';
        let text = 'Edit';
        MoveButton = this.CreateButton(text,left);

        MoveButton.onclick = function ()
        {
            inEditMode = !inEditMode;
            if (inEditMode)
            {
                PlaceButton.style.display = "none";
                ResetButton.style.display = "none";
                document.getElementById("OpenButton").style.display = "none";
                SelectButton.style.display = "block";
                defaultGui.hide();
                transformGui.show();
                if (SpawnedWallTrims)
                paramsWallTrimHeight.height = SpawnedWallTrims[0].position.y;
            }
            else
            {
                PlaceButton.style.display = "block";
                ResetButton.style.display = "block";
                document.getElementById("OpenButton").style.display = "block";
                SelectButton.style.display = "none";
                defaultGui.show();
                transformGui.hide();
                app.UpdateTrimColor();
            }

        }

        document.body.appendChild(MoveButton);
    }

    CreateSelectButton()
    {
        let left = 'calc(50% - 50px)';
        let text = 'Select';
        SelectButton = this.CreateButton(text,left);

        SelectButton.onclick = function ()
        {
            app.SelectClicked();
        }

        document.body.appendChild(SelectButton);
    }

    CreateResetButton()
    {
        let left = 'calc(85% - 50px)';
        let text = 'Reset';
        ResetButton = this.CreateButton(text,left)

        ResetButton.onclick = function ()
        {
            app.ResetClicked();
        }

        document.body.appendChild(ResetButton);
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

    SelectClicked()
    {
        selectedFrame = false;
        //Check walltrims
        if (ConnectedWallTrims)
        {
            this.UpdateTrimColor();
            TrimsToMove = null;
            for (let i = 0; i < ConnectedWallTrims.length; ++i)
            {
                let currentTrims = ConnectedWallTrims[i];
                for (let j = 0; j < currentTrims.length; ++j)
                {
                    let distanceToMarker = currentTrims[j].position.distanceToSquared(this.reticle.position);
                    if (distanceToMarker < 1)
                    {
                        TrimsToMove = currentTrims;
                        paramsWallTrimHeight.height = currentTrims[j].position.y;
                        this.RecolorSelectedTrims();
                        return;
                    }
                }
            }
        }


        //Check wallframes
        if (ConnectedWallframes)
        {
            for (let i = 0; i < ConnectedWallframes.length; ++i)
            {
                let currentFrame = ConnectedWallframes[i]
                for (let j = 0; j < currentFrame.children.length; ++j)
                {
                    let distanceToMarker = currentFrame.children[j].position.distanceToSquared(this.reticle.position);
                    if (distanceToMarker < 1)
                    {
                        FrameToMove = currentFrame;
                        FtMClippingPlanes = UsedClippingPlanesWallFrames[i];
                        this.RecolorSelectedFrame();
                        selectedFrame = true;
                        return;
                    }
                }
            }
        }
    }

    RecolorSelectedFrame()
    {
        for (let i = 0; i < FrameToMove.children.length; ++i)
        {
            FrameToMove.children[i].children[0].material.color.setHex(0x00FF00);
        }
    }

    RecolorSelectedTrims()
    {
        for (let i = 0; i < TrimsToMove.length; ++i)
        {
            TrimsToMove[i].children[0].material.color.setHex(0x00FF00);
        }
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
        this.ResetDoorTrims();
    }

    DoneClicked()
    {
        document.getElementById("OpenButton").style.display = "block";
        this.CreatePlaceButton();
        this.CreateResetButton();
        this.CreateEditButton();
        this.CreateSelectButton();
        DoneButton.style.display = "none"
        WallframesButton.style.display = 'none';
        SelectButton.style.display = "none";
        PlacingPointsWallframes = false;
        this.ResetWallframePoints();
        //this.ResetWallPoints();

        //Set up colorPicker
        defaultGui = new dat.GUI();
        transformGui = new dat.GUI();
        transformGui.hide();

        //Manually call update so color variable gets properly initalized with the default value of the picker
        this.UpdateTrimColor();
        this.UpdateDecorationColor();
        this.UpdateWallColor();

        //Set a callback so that whenever user changes a value, it calls the update
        defaultGui.addColor(paramsTrimColor, 'trimColor').onChange(this.UpdateTrimColor);
        defaultGui.addColor(paramsDecorationColor, 'decorationColor').onChange(this.UpdateDecorationColor);
        defaultGui.addColor(paramsWallColor, 'wallColor').onChange(this.UpdateWallColor);
        defaultGui.add(paramsFillPlanes,'fillPlanes').onChange(this.UpdatePlaneFill);
        defaultGui.add(paramsVisibility, 'showGuides').onChange(this.UpdateGuideVisibility);

        transformGui.add(paramsWallTrimHeight,'height',ConstrainedYPosWalls - WallHeight,ConstrainedYPosWalls).onChange(this.MoveWallTrims);
    }

    SelectWallframesClicked()
    {
        PlacingPointsWallframes = true;
        WallframesButton.style.display = 'none';
    }
}

window.app = new App();