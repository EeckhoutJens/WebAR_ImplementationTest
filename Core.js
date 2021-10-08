window.gltfLoader = new THREE.GLTFLoader();
//General UI functions
function SetModelID(id, type)
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
    if (type === "set")
    {
        decoType = DecorationTypes.Set;
        if (id === "test")
            setType = SetTypes.Test;
        assignSetIDs();
    }

}

function assignSetIDs()
{
    SetIDs.length = 0;
    switch (setType)
    {
        case SetTypes.Test:
            SetIDs.push("C341");
            SetIDs.push("SX118");
            SetIDs.push("P4020");
            break;
    }
}

function openNav() {
    document.getElementById("mySidenav").style.width = "250px";
    gui.hide();
    document.getElementsByTagName("button")[0].style.display = "none";
}

function closeNav() {
    document.getElementById("mySidenav").style.width = "0";
    gui.show();
    document.getElementsByTagName("button")[0].style.display = "block";
}

function openSub1()
{
    if (document.getElementById("sub-menu-1").style.display === "none")
        document.getElementById("sub-menu-1").style.display = "block";
    else
        document.getElementById("sub-menu-1").style.display = "none";

}

function openSub2()
{
    if (document.getElementById("sub-menu-2").style.display === "none")
        document.getElementById("sub-menu-2").style.display = "block";
    else
        document.getElementById("sub-menu-2").style.display = "none";

}

function openSub3()
{
    if (document.getElementById("sub-menu-3").style.display === "none")
        document.getElementById("sub-menu-3").style.display = "block";
    else
        document.getElementById("sub-menu-3").style.display = "none";

}

function openSub4()
{
    if (document.getElementById("sub-menu-4").style.display === "none")
        document.getElementById("sub-menu-4").style.display = "block";
    else
        document.getElementById("sub-menu-4").style.display = "none";

}

function openSub5()
{
    if (document.getElementById("sub-menu-5").style.display === "none")
        document.getElementById("sub-menu-5").style.display = "block";
    else
        document.getElementById("sub-menu-5").style.display = "none";
}

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
const Points = [];
const Planes = [];
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
        Set: "set"
    }

    let decoType = DecorationTypes.Decoration;


const SetTypes =
    {
        Test: "test"
    }

    let setType = SetTypes.Test;

let reticleHitTestResult;
//PLANE DETECTION
//First step, place 2 points to determine the height of the walls
let IsDeterminingHeight = true;
let Height = 0;
//Ensures all the dots are placed on the same Y position
let ConstrainedYPos = 0;

//Second step, place points in the top left corner of adjacent wall
let PlacingPoints = false;
const MinDistance = 0.2;
let NrOfPlanes = 0;

//Third step, if a placed point is close enough to a previous point close of and move to next step
let FinishedPlacingPlanes = false;
//-------------------------------------------------------------------------------------------------

let ModelID;
let SpawnedDecorations = [];
let HitPlaneDirection;
let IsDirectionX = false;
let CurrentFrame;
let pmremGenerator;
let gui;
let params = {color: "#919197" };
let color;

//Container class to handle WebXR logic
//Adapted from the AR with WebXR workshop project by Google
class App {
    /**
     * Run when the Start AR button is pressed.
     */

    activateXR = async () => {
        try {
            /** initialize a WebXR session using extra required features. */
            this.xrSession = await navigator.xr.requestSession("immersive-ar", {
                requiredFeatures: ['hit-test', 'dom-overlay', 'anchors'],
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

        /** To help with working with 3D on the web, we'll use three.js. */
        this.setupThreeJs();

        /** Setup an XRReferenceSpace using the "local" coordinate system. */
        this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');

        /** Create another XRReferenceSpace that has the viewer as the origin. */
        this.viewerSpace = await this.xrSession.requestReferenceSpace('viewer');

        /** Perform hit testing using the viewer as origin. */
        this.hitTestSource = await this.xrSession.requestHitTestSource({ space: this.viewerSpace });

        /** Start a rendering loop using this.onXRFrame. */
        this.xrSession.requestAnimationFrame(this.onXRFrame);

        this.xrSession.addEventListener("select", this.onSelect);
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
                document.body.classList.add('stabilized');
            }
            if (hitTestResults.length > 0) {
                let hitPose = hitTestResults[0].getPose(this.localReferenceSpace);

                /** Update the reticle position. */
                reticleHitTestResult = hitTestResults[0];
                this.reticle.visible = true;
                this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
                this.reticle.updateMatrixWorld(true);
            }

            // only update the object's position if it's still in the list
            // of frame.trackedAnchors
            for (const {anchoredObject, anchor} of Points)
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

        /** Initialize our demo scene. */
        const scene = new THREE.Scene();

        // The materials will render as a black mesh
        // without lights in our scenes. Let's add an ambient light
        // so our material can be visible, as well as a directional light
        // for the shadow.
        const light = new THREE.AmbientLight(0x222222);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 1, 0.75).normalize();

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

        // Add lights and shadow material to scene.
        scene.add(shadowMesh);
        scene.add(light);
        scene.add(directionalLight);

        this.scene = scene;
        this.reticle = new Reticle();
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

    UpdateColor()
    {
        color = new THREE.Color(params.color);
    }

    /** Place a point when the screen is tapped.
     * Once 2 or more points have been placed create lines*/
        //Ensure to change Z to Y when testing vertical planes
    onSelect = () =>
    {
        if (PlacingPoints)
        {
            for (const {anchoredObject, anchor} of Points)
            {
                let distanceToMarker = anchoredObject.position.distanceToSquared(this.reticle.position);
                if (distanceToMarker < MinDistance)
                {
                    FinishedPlacingPlanes = true;
                    PlacingPoints = false;
                    this.CreatePlanes();
                    this.DrawPlanes();
                    document.getElementById("OpenButton").style.display = "block";
                    this.CreateButton();


                    //Set up colorPicker
                    gui = new dat.GUI();

                    //Manually call update so color variable gets properly initalized with the default value of the picker
                    this.UpdateColor();

                    //Set a callback so that whenever the value of the picker changes, it calls the update
                    gui.addColor(params, 'color').onChange(this.UpdateColor);
                    break;
                }
            }
            if (!FinishedPlacingPlanes)
            {
                let FirstLocation = new THREE.Vector3(0,0,0);
                FirstLocation.copy(this.reticle.position);
                FirstLocation.z = ConstrainedYPos;
                let Point1 = this.CreateSphere(FirstLocation)

                reticleHitTestResult.createAnchor().then((anchor) =>
                {
                    Points.push({
                        anchoredObject: Point1,
                        anchor: anchor
                    });

                    if (Points.length >= 4)
                    {
                        ++NrOfPlanes;
                    }
                });

                let SecondLocation = new THREE.Vector3(0,0,0);
                SecondLocation.copy(FirstLocation);
                SecondLocation.z = ConstrainedYPos - Height;
                let Point2 = this.CreateSphere(SecondLocation);
                let hitPose = reticleHitTestResult.getPose(this.localReferenceSpace);
                let transformPosition = new THREE.Vector3(0,0,0);
                transformPosition.copy(hitPose.transform.position);
                transformPosition.z = ConstrainedYPos - Height;
                let XRTransform = new XRRigidTransform(transformPosition, hitPose.transform.orientation);

                reticleHitTestResult.createAnchor(XRTransform, this.localReferenceSpace).then((anchor) =>
                {
                    Points.push({
                        anchoredObject: Point2,
                        anchor: anchor
                    });

                    if (Points.length >= 4)
                    {
                        ++NrOfPlanes;
                    }
                });

            }
        }

        if (IsDeterminingHeight)
        {
            let test = this.CreateSphere(this.reticle.position);
            reticleHitTestResult.createAnchor().then((anchor) =>
            {
                Points.push({
                    anchoredObject: test,
                    anchor: anchor
                });

                if (Points.length === 2)
                {
                    ConstrainedYPos = Points[1].anchoredObject.position.z;
                    Height = ConstrainedYPos - Points[0].anchoredObject.position.z;
                    this.ResetPoints();
                    IsDeterminingHeight = false;
                    PlacingPoints = true;
                }
            });
        }
    }

    ResetPoints()
    {
        for(let i= 0; i < Points.length; ++i)
        {
            this.scene.remove(Points[i].anchoredObject);
            Points[i].anchor.delete();
        }
        Points.length = 0;
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
        for(let i = 0; i < NrOfPlanes; ++i)
        {
            //Add Points that define plane to array and store that array
            //LeftTop - LeftBottom - RightBottom - RightTop
            const planePoints = [];
            planePoints.push(Points[startIndex].anchoredObject.position);
            planePoints.push(Points[startIndex + 1].anchoredObject.position)
            planePoints.push(Points[startIndex + 3].anchoredObject.position)
            planePoints.push(Points[startIndex + 2].anchoredObject.position)
            Planes.push(planePoints);
            startIndex += 2;
        }
    }

    DrawPlanes()
    {
        for(let i = 0; i < Planes.length; ++i)
        {
            var Points = Planes[i];
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
        }
    }

    LoadModel(position, scene)
    {
        let inPlane = this.IsInPlane(this.reticle.position);

        new THREE.RGBELoader()
            .setDataType(THREE.UnsignedByteType)
            .setPath('Textures/')
            .load('lebombo_1k.hdr', function (texture) {
                var envmap = pmremGenerator.fromEquirectangular(texture).texture;
                scene.environment = envmap;
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
                                    child.material.color = color;
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

    GenerateCeilingTrims(ID)
    {
        this.ResetCeilingTrims();
        for(let currentPlane = 0; currentPlane < Planes.length; ++currentPlane)
        {
            let currentPoints = Planes[currentPlane];

            //Check direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints);
            let absDirection = new THREE.Vector3(0,0,0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            IsDirectionX = absDirection.x > absDirection.z;

            let positionOffset = new THREE.Vector3(0,0,0);
            let nrToSpawn = 0;

            //Initial load so we can use data to calculate additional nr of meshes we still need to load after this
            window.gltfLoader.load(ID + ".gltf", function (gltf)
            {
                let loadedScene = gltf.scene;
                let trimToSpawn;
                loadedScene.traverse((child) => {
                    if(child.isMesh)
                    {
                        child.material.color = color;
                        trimToSpawn = child.parent;
                    }
                });
                trimToSpawn.position.copy(currentPoints[0]);
                let box = new THREE.Box3().setFromObject(trimToSpawn);
                let dimensions = new THREE.Vector3(0,0,0);
                box.getSize(dimensions);

                if (IsDirectionX)
                {
                    nrToSpawn = Math.round(absDirection.x / dimensions.x);
                    if (direction.x < 0)
                    {
                        trimToSpawn.rotateY(Math.PI);
                        positionOffset.x = -dimensions.x;
                        trimToSpawn.position.x -= dimensions.x / 2;
                    }
                    else
                    {
                        positionOffset.x = dimensions.x;
                        trimToSpawn.position.x += dimensions.x / 2;
                    }

                }
                else
                {
                    nrToSpawn = Math.round(absDirection.z / dimensions.x);
                    if (direction.z < 0)
                    {
                        trimToSpawn.rotateY(Math.PI / 2)
                        positionOffset.z = -dimensions.x;
                        trimToSpawn.position.z -= dimensions.x / 2;
                    }
                    if (direction.z > 0)
                    {
                        trimToSpawn.rotateY(-Math.PI / 2)
                        positionOffset.z = dimensions.x;
                        trimToSpawn.position.z += dimensions.x / 2;
                    }
                }
                let XRTransform = new XRRigidTransform(trimToSpawn.position, trimToSpawn.orientation);
                reticleHitTestResult.createAnchor(XRTransform, app.localReferenceSpace).then((anchor) =>
                {
                    SpawnedCeilingTrims.push({
                        anchoredObject: trimToSpawn,
                        anchor: anchor
                    });
                });
                app.scene.add(trimToSpawn);

                //Decrement nr by one seeing as we already spawned one to get the data
                --nrToSpawn;

                //Now we load enough meshes to fill up top line of plane
                for(let i = 1; i <= nrToSpawn; ++i)
                {
                    window.gltfLoader.load(ID + ".gltf", function (gltf2)
                    {
                        let loadedScene = gltf2.scene;
                        let trimToSpawn2;
                        loadedScene.traverse((child) => {
                            if(child.isMesh)
                            {
                                child.material.color = color;
                                trimToSpawn2 = child.parent;
                            }
                        });
                        trimToSpawn2.position.copy(currentPoints[0]);
                        trimToSpawn2.position.addScaledVector(positionOffset,i);
                        if (IsDirectionX)
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
                            SpawnedCeilingTrims.push({
                                anchoredObject: trimToSpawn2,
                                anchor: anchor
                            });
                        });
                        app.scene.add(trimToSpawn2);
                    })
                }
            })
        }
    }

    GenerateFloorTrims(ID)
    {
        this.ResetFloorTrims();
        for(let currentPlane = 0; currentPlane < Planes.length; ++currentPlane)
        {
            let currentPoints = Planes[currentPlane];

            //Check direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints);
            let absDirection = new THREE.Vector3(0,0,0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            IsDirectionX = absDirection.x > absDirection.z;

            let positionOffset = new THREE.Vector3(0,0,0);
            let nrToSpawn = 0;

            //Initial load so we can use data to calculate additional nr of meshes we still need to load after this
            window.gltfLoader.load(ID + ".gltf", function (gltf)
            {
                let loadedScene = gltf.scene;
                let trimToSpawn;
                loadedScene.traverse((child) => {
                    if(child.isMesh)
                    {
                        child.material.color = color;
                        trimToSpawn = child.parent;
                    }
                });
                trimToSpawn.position.copy(currentPoints[1]);
                let box = new THREE.Box3().setFromObject(trimToSpawn);
                let dimensions = new THREE.Vector3(0,0,0);
                box.getSize(dimensions);

                if (IsDirectionX)
                {
                    nrToSpawn = Math.round(absDirection.x / dimensions.x);
                    if (direction.x < 0)
                    {
                        trimToSpawn.rotateY(Math.PI);
                        positionOffset.x = -dimensions.x;
                        trimToSpawn.position.x -= dimensions.x / 2;
                    }
                    else
                    {
                        positionOffset.x = dimensions.x;
                        trimToSpawn.position.x += dimensions.x / 2;
                    }

                }
                else
                {
                    nrToSpawn = Math.round(absDirection.z / dimensions.x);
                    if (direction.z < 0)
                    {
                        trimToSpawn.rotateY(Math.PI / 2)
                        positionOffset.z = -dimensions.x;
                        trimToSpawn.position.z -= dimensions.x / 2;
                    }
                    if (direction.z > 0)
                    {
                        trimToSpawn.rotateY(-Math.PI / 2)
                        positionOffset.z = dimensions.x;
                        trimToSpawn.position.z += dimensions.x / 2;
                    }
                }
                let XRTransform = new XRRigidTransform(trimToSpawn.position, trimToSpawn.orientation);
                reticleHitTestResult.createAnchor(XRTransform, app.localReferenceSpace).then((anchor) =>
                {
                    SpawnedFloorTrims.push({
                        anchoredObject: trimToSpawn,
                        anchor: anchor
                    });
                });
                app.scene.add(trimToSpawn);

                //Decrement nr by one seeing as we already spawned one to get the data
                --nrToSpawn;

                //Now we load enough meshes to fill up bottom line of plane if necessary
                for(let i = 1; i <= nrToSpawn; ++i)
                {
                    window.gltfLoader.load(ID + ".gltf", function (gltf)
                    {
                        let loadedScene = gltf.scene;
                        let trimToSpawn2;
                        loadedScene.traverse((child) => {
                            if(child.isMesh)
                            {
                                child.material.color = color;
                                trimToSpawn2 = child.parent;
                            }
                        });
                        trimToSpawn2.position.copy(currentPoints[1]);
                        trimToSpawn2.position.addScaledVector(positionOffset, i);
                        if (IsDirectionX)
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
                            SpawnedFloorTrims.push({
                                anchoredObject: trimToSpawn2,
                                anchor: anchor
                            });
                        });
                        app.scene.add(trimToSpawn2);
                    })
                }
            })
        }
    }

    //Ensure to change Z to Y when testing vertical planes
    GenerateWallTrims(ID)
    {
        this.ResetWallTrims();
        for(let currentPlane = 0; currentPlane < Planes.length; ++currentPlane)
        {
            let currentPoints = Planes[currentPlane];

            //Check direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints);
            let absDirection = new THREE.Vector3(0,0,0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            IsDirectionX = absDirection.x > absDirection.z;

            let positionOffset = new THREE.Vector3(0,0,0);
            let nrToSpawn = 0;

            //Initial load so we can use data to calculate additional nr of meshes we still need to load after this
            window.gltfLoader.load(ID + ".gltf", function (gltf)
            {
                let loadedScene = gltf.scene;
                let trimToSpawn;
                loadedScene.traverse((child) => {
                    if(child.isMesh)
                    {
                        child.material.color = color;
                        trimToSpawn = child.parent;
                    }

                });
                trimToSpawn.position.copy(currentPoints[0]);
                trimToSpawn.position.z = app.reticle.position.z;
                let box = new THREE.Box3().setFromObject(trimToSpawn);
                let dimensions = new THREE.Vector3(0,0,0);
                box.getSize(dimensions);
                if (IsDirectionX)
                {
                    nrToSpawn = Math.round(absDirection.x / dimensions.x);
                    if (direction.x < 0)
                    {
                        trimToSpawn.rotateY(Math.PI);
                        positionOffset.x = -dimensions.x;
                        trimToSpawn.position.x -= dimensions.x / 2;
                    }
                    else
                    {
                        positionOffset.x = dimensions.x;
                        trimToSpawn.position.x += dimensions.x / 2;
                    }

                }
                else
                {
                    nrToSpawn = Math.round(absDirection.z / dimensions.x);
                    if (direction.z < 0)
                    {
                        trimToSpawn.rotateY(Math.PI / 2)
                        positionOffset.z = -dimensions.x;
                        trimToSpawn.position.z -= dimensions.x / 2;
                    }
                    if (direction.z > 0)
                    {
                        trimToSpawn.rotateY(-Math.PI / 2)
                        positionOffset.z = dimensions.x;
                        trimToSpawn.position.z += dimensions.x / 2;
                    }
                }
                let XRTransform = new XRRigidTransform(trimToSpawn.position, trimToSpawn.orientation);
                reticleHitTestResult.createAnchor(XRTransform, app.localReferenceSpace).then((anchor) =>
                {
                    SpawnedWallTrims.push({
                        anchoredObject: trimToSpawn,
                        anchor: anchor
                    });
                });
                app.scene.add(trimToSpawn);

                //Decrement nr by one seeing as we already spawned one to get the data
                --nrToSpawn;

                //Now we load enough meshes to fill up wall
                for(let i = 1; i <= nrToSpawn; ++i)
                {
                    window.gltfLoader.load(ID + ".gltf", function (gltf2)
                    {
                        let loadedScene = gltf2.scene;
                        let trimToSpawn2;
                        loadedScene.traverse((child) => {
                            if(child.isMesh)
                            {
                                child.material.color = color;
                                trimToSpawn2 = child.parent;
                            }

                        });
                        trimToSpawn2.position.copy(currentPoints[0]);
                        trimToSpawn2.position.z = app.reticle.position.z;
                        trimToSpawn2.position.addScaledVector(positionOffset, i);

                        if (IsDirectionX)
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
                            SpawnedWallTrims.push({
                                anchoredObject: trimToSpawn2,
                                anchor: anchor
                            });
                        });
                        app.scene.add(trimToSpawn2);
                    })
                }
            })
        }
    }

    //Ensure to change Z to Y when testing vertical planes
    IsInPlane(position)
    {
        var inside = false;
        for(var currentPlaneId = 0; currentPlaneId < Planes.length;++currentPlaneId)
        {
            var highest = new THREE.Vector3(0,0,0);
            var lowest = new THREE.Vector3(0,0,0);
            var currentPoints = Planes[currentPlaneId];
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
            let absDirection = new THREE.Vector3(0,0,0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            IsDirectionX = absDirection.x > absDirection.z;


            //Check if given position is within boundary
            if (IsDirectionX)
            {
                if (position.x <= highest.x && position.x >= lowest.x
                    &&position.z <= highest.z && position.z >= lowest.z)
                {
                    inside = true;
                    HitPlaneDirection = direction;
                }
            }
            else
            {
                if (position.z <= highest.z && position.z >= lowest.z
                    && position.x <= highest.x && position.x >= lowest.x)
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

        return direction;
    }

    CreateButton()
    {
        const button = document.createElement('button');

        button.style.display = '';

        button.style.cursor = 'pointer';
        button.style.left = 'calc(50% - 50px)';
        button.style.width = '100px';
        button.textContent = 'Place';
        this.stylizeElement(button);

        button.onmouseenter = function () {

            button.style.opacity = '1.0';

        };

        button.onmouseleave = function () {

            button.style.opacity = '0.5';

        };

        button.onclick = function ()
        {
            app.PlaceClicked();
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
        if (FinishedPlacingPlanes)
        {
            if (ModelID != null)
                this.LoadModel(this.reticle.position, this.scene);
        }
    }
}

window.app = new App();