window.gltfLoader = new THREE.GLTFLoader();
//General UI functions
function SetModelID(id)
{
    ModelID = id;
}

function openNav() {
    document.getElementById("mySidenav").style.width = "250px";
}

function closeNav() {
    document.getElementById("mySidenav").style.width = "0";
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

//PLANE DETECTION
//First step, place 2 points to determine the height of the walls
let IsDeterminingHeight = true;
let Height = 0;
//Allows to make sure all the dots are placed on the same Y position
let ConstrainedYPos = 0;

//Second step, place points in the top corners of adjacent wall
let PlacingPoints = false;
const MinDistance = 0.2;
let NrOfPlanes = 0;

//Third step, if a placed point is close enough to a previous point close of and move to next step
let FinishedPlacingPlanes = false;
//-------------------------------------------------------------------------------------------------

let ModelID;
let SpawnedModel;
let PlaneToSpawnIn;

let pmremGenerator;

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
                requiredFeatures: ['hit-test', 'dom-overlay'],
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
                this.reticle.visible = true;
                this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
                this.reticle.updateMatrixWorld(true);
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
        directionalLight.position.set(0, 1, 0).normalize();

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

    /** Place a point when the screen is tapped.
     * Once 2 or more points have been placed create lines*/
    onSelect = () =>
    {
        if (PlacingPoints)
        {
            for(let i = 0; i < Points.length; ++i)
            {
                let distanceToMarker = Points[i].position.distanceToSquared(this.reticle.position);
                if (distanceToMarker < MinDistance)
                {
                    FinishedPlacingPlanes = true;
                    PlacingPoints = false;
                    this.CreatePlanes();
                    this.DrawPlanes();
                    document.getElementById("OpenButton").style.display = "block";
                    this.CreateButton();
                }
            }
            if (!FinishedPlacingPlanes)
            {
                let FirstLocation = new THREE.Vector3(0,0,0);
                FirstLocation.copy(this.reticle.position);
                FirstLocation.y = ConstrainedYPos;
                this.CreateSphere(this.reticle.position);
                let SecondLocation = new THREE.Vector3(0,0,0);
                SecondLocation.copy(this.reticle.position);
                SecondLocation.y = ConstrainedYPos - Height;
                this.CreateSphere(SecondLocation);
                if (Points.length >= 4)
                {
                    ++NrOfPlanes;
                }
            }
        }

        if (IsDeterminingHeight)
        {
            this.CreateSphere(this.reticle.position);
            if (Points.length === 2)
            {
                ConstrainedYPos = Points[1].position.y;
                Height = Points[1].position.y - Points[0].position.y;
                this.ResetPoints();
                IsDeterminingHeight = false;
                PlacingPoints = true;
            }
            }
    }

    ResetPoints()
    {
        for(let i= 0; i < Points.length; ++i)
        {
            this.scene.remove(Points[i]);
        }
        Points.length = 0;
    }

    CreateSphere(position)
    {
        const sphereGeometry = new THREE.SphereGeometry(0.05,32,16);
        const sphereMaterial = new THREE.MeshBasicMaterial({color: 0xfff00});
        const sphere = new THREE.Mesh(sphereGeometry,sphereMaterial);
        sphere.position.copy(position);
        this.scene.add(sphere)
        Points.push(sphere);
    }

    CreatePlanes()
    {
        let startIndex = 0;
        for(let i = 0; i < NrOfPlanes; ++i)
        {
            //Add Points that define plane to array and store that array
            //LeftTop - LeftBottom - RightBottom - RightTop
            const planePoints = [];
            planePoints.push(Points[startIndex].position);
            planePoints.push(Points[startIndex + 1].position)
            planePoints.push(Points[startIndex + 3].position)
            planePoints.push(Points[startIndex + 2].position)
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
        if (!this.IsInPlane(position))
            return;
        if (SpawnedModel != null)
        {
            this.scene.remove(SpawnedModel);
        }
        let direction = this.CalculatePlaneDirection();
        let absDirection = new THREE.Vector3(0,0,0);
        absDirection.copy(direction);
        absDirection.x = Math.abs(absDirection.x);
        absDirection.y = Math.abs(absDirection.y);
        absDirection.z = Math.abs(absDirection.z);
        new THREE.RGBELoader()
            .setDataType(THREE.UnsignedByteType)
            .setPath('Textures/')
            .load('photo_studio_01_1k.hdr', function (texture) {
                var envmap = pmremGenerator.fromEquirectangular(texture).texture;
                //scene.environment = envmap;
                texture.dispose();
                pmremGenerator.dispose();
                window.gltfLoader.setPath('3D/');
                window.gltfLoader.load(ModelID + ".gltf", function (gltf) {
                    SpawnedModel = gltf.scene;
                    if (absDirection.x > absDirection.z)
                    {
                        if (direction.x < 0)
                            SpawnedModel.rotateY(Math.PI);
                    }
                    else
                    {
                        if (direction.z  < 0)
                            SpawnedModel.rotateY(-Math.PI / 2)
                        if (direction.z  > 0)
                            SpawnedModel.rotateY(Math.PI / 2)

                    }
                    SpawnedModel.position.copy(position);
                    scene.add(SpawnedModel);
                    const shadowMesh = scene.children.find(c => c.name === 'shadowMesh');
                    shadowMesh.position.y = SpawnedModel.position.y
                });
            });
    }

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
            //Check if given position is within boundary
            if (position.x <= highest.x && position.x >= lowest.x
                &&position.y <= highest.y && position.y >= lowest.y)
            {
                inside = true;
                PlaneToSpawnIn = Planes[currentPlaneId];
            }
        }

        return inside;
    }

    CalculatePlaneDirection()
    {
        let direction = new THREE.Vector3(0,0,0);
        direction.copy(PlaneToSpawnIn[2]);
        direction.sub(PlaneToSpawnIn[1]);

        return direction;
    }

    CreateButton()
    {
        const button = document.createElement('button');

        button.style.display = '';

        button.style.cursor = 'pointer';
        button.style.left = 'calc(50% - 50px)';
        button.style.width = '100px';
        button.textContent = 'NEXT';
        this.stylizeElement(button);

        button.onmouseenter = function () {

            button.style.opacity = '1.0';

        };

        button.onmouseleave = function () {

            button.style.opacity = '0.5';

        };

        button.onclick = function ()
        {
            this.PlaceClicked();
        }

        document.body.appendChild(button);
    }

    stylizeElement( element ) {

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