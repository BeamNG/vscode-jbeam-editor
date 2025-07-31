// mirrorPlaneDetection.js

/**
 * Calculates mirror planes from a set of 3D points using PCA.
 * This implementation does not rely on any external libraries.
 */

/**
 * Calculates mirror planes using Principal Component Analysis (PCA).
 * @param {Array} points - An array of point objects, each with a 'pos' property as [x, y, z].
 * @returns {Array} An array of mirror plane objects, each with a 'normal' vector and a 'point'.
 */
function calculateMirrorPlanes(points) {
  if (!points || points.length === 0) {
    throw new Error("No points provided for mirror plane calculation.");
  }

  // Step 1: Compute the centroid of all points
  const centroid = computeCentroid(points);

  // Step 2: Center the points by subtracting the centroid
  const centeredPositions = centerPoints(points, centroid);

  // Step 3: Compute the covariance matrix
  const covarianceMatrix = computeCovarianceMatrix(centeredPositions);

  // Step 4: Perform eigenvalue decomposition on the covariance matrix
  const { eigenvalues, eigenvectors } = eigenDecomposition(covarianceMatrix);

  // Step 5: Identify mirror planes using the eigenvectors
  const mirrorPlanes = eigenvectors.map((vec, idx) => ({
    normal: {
      x: vec[0],
      y: vec[1],
      z: vec[2],
    },
    point: centroid,
    eigenvalue: eigenvalues[idx],
  }));

  return mirrorPlanes;
}

/**
 * Computes the centroid of a set of points.
 * @param {Array} points - An array of point objects.
 * @returns {Object} The centroid with properties x, y, z.
 */
function computeCentroid(points) {
  const centroid = { x: 0, y: 0, z: 0 };
  const N = points.length;

  points.forEach((node) => {
    centroid.x += node.rpos3d.x;
    centroid.y += node.rpos3d.y;
    centroid.z += node.rpos3d.z;
  });

  centroid.x /= N;
  centroid.y /= N;
  centroid.z /= N;

  return centroid;
}

/**
 * Centers the points by subtracting the centroid.
 * @param {Array} points - An array of point objects.
 * @param {Object} centroid - The centroid of the points.
 * @returns {Array} An array of centered position arrays [x, y, z].
 */
function centerPoints(points, centroid) {
  return points.map((node) => [
    node.rpos3d.x - centroid.x,
    node.rpos3d.y - centroid.y,
    node.rpos3d.z - centroid.z,
  ]);
}

/**
 * Computes the covariance matrix for a set of centered points.
 * @param {Array} centeredPositions - An array of centered position arrays [x, y, z].
 * @returns {Array} A 3x3 covariance matrix.
 */
function computeCovarianceMatrix(centeredPositions) {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  centeredPositions.forEach((pos) => {
    C[0][0] += pos[0] * pos[0];
    C[0][1] += pos[0] * pos[1];
    C[0][2] += pos[0] * pos[2];
    C[1][0] += pos[1] * pos[0];
    C[1][1] += pos[1] * pos[1];
    C[1][2] += pos[1] * pos[2];
    C[2][0] += pos[2] * pos[0];
    C[2][1] += pos[2] * pos[1];
    C[2][2] += pos[2] * pos[2];
  });

  const N = centeredPositions.length;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i][j] /= N;
    }
  }

  return C;
}

/**
 * Performs eigenvalue decomposition on a symmetric 3x3 matrix using the Jacobi algorithm.
 * @param {Array} matrix - A 3x3 symmetric matrix.
 * @returns {Object} An object containing 'eigenvalues' and 'eigenvectors'.
 */
function eigenDecomposition(matrix) {
  const MAX_ITER = 100;
  const EPSILON = 1e-10;

  // Initialize eigenvectors as the identity matrix
  let eigenvectors = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  // Make a deep copy of the matrix to avoid modifying the original
  let A = [
    [matrix[0][0], matrix[0][1], matrix[0][2]],
    [matrix[1][0], matrix[1][1], matrix[1][2]],
    [matrix[2][0], matrix[2][1], matrix[2][2]],
  ];

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Step 1: Find the largest off-diagonal element in A
    let max = Math.abs(A[0][1]);
    let p = 0;
    let q = 1;

    if (Math.abs(A[0][2]) > max) {
      max = Math.abs(A[0][2]);
      p = 0;
      q = 2;
    }

    if (Math.abs(A[1][2]) > max) {
      max = Math.abs(A[1][2]);
      p = 1;
      q = 2;
    }

    // Step 2: Check for convergence
    if (max < EPSILON) {
      break;
    }

    // Step 3: Compute the Jacobi rotation to zero out A[p][q]
    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];

    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    // Rotate matrix A
    const a_pp = c * c * app - 2 * s * c * apq + s * s * aqq;
    const a_qq = s * s * app + 2 * s * c * apq + c * c * aqq;

    A[p][p] = a_pp;
    A[q][q] = a_qq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let r = 0; r < 3; r++) {
      if (r !== p && r !== q) {
        const a_pr = A[p][r];
        const a_qr = A[q][r];
        A[p][r] = c * a_pr - s * a_qr;
        A[r][p] = A[p][r];
        A[q][r] = s * a_pr + c * a_qr;
        A[r][q] = A[q][r];
      }
    }

    // Update eigenvectors
    for (let r = 0; r < 3; r++) {
      const v_pr = eigenvectors[r][p];
      const v_qr = eigenvectors[r][q];
      eigenvectors[r][p] = c * v_pr - s * v_qr;
      eigenvectors[r][q] = s * v_pr + c * v_qr;
    }
  }

  // Extract eigenvalues from the diagonal of A
  let eigenvalues = [A[0][0], A[1][1], A[2][2]];

  // Extract eigenvectors
  // Each column in eigenvectors corresponds to an eigenvector
  // Normalize eigenvectors
  for (let i = 0; i < 3; i++) {
    const norm = Math.sqrt(
      eigenvectors[0][i] * eigenvectors[0][i] +
        eigenvectors[1][i] * eigenvectors[1][i] +
        eigenvectors[2][i] * eigenvectors[2][i]
    );
    if (norm > 0) {
      eigenvectors[0][i] /= norm;
      eigenvectors[1][i] /= norm;
      eigenvectors[2][i] /= norm;
    }
  }

  // Sort eigenvalues and eigenvectors in descending order
  const sortedIndices = [0, 1, 2].sort((a, b) => eigenvalues[b] - eigenvalues[a]);
  eigenvalues = sortedIndices.map((idx) => eigenvalues[idx]);
  eigenvectors = [
    [eigenvectors[0][sortedIndices[0]], eigenvectors[0][sortedIndices[1]], eigenvectors[0][sortedIndices[2]]],
    [eigenvectors[1][sortedIndices[0]], eigenvectors[1][sortedIndices[1]], eigenvectors[1][sortedIndices[2]]],
    [eigenvectors[2][sortedIndices[0]], eigenvectors[2][sortedIndices[1]], eigenvectors[2][sortedIndices[2]]],
  ];

  return { eigenvalues, eigenvectors };
}

/**
 * Mirrors a point across a specified plane.
 * @param {Array} point - The original point as [x, y, z].
 * @param {Object} planeNormal - The normal vector of the plane {x, y, z}.
 * @param {Object} planePoint - A point on the plane {x, y, z}.
 * @returns {Array} The mirrored point as [x, y, z].
 */
function mirrorPointAcrossPlane(point, planeNormal, planePoint) {
  const pointVector = new THREE.Vector3(point[0], point[1], point[2]);
  const planePointVector = new THREE.Vector3(planePoint.x, planePoint.y, planePoint.z);
  const normalVector = new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z).normalize();

  // Compute the vector from the plane point to the original point
  const v = pointVector.clone().sub(planePointVector);

  // Compute the distance from the point to the plane
  const dist = v.dot(normalVector);

  // Compute the mirrored position
  const mirroredPoint = pointVector.clone().sub(normalVector.clone().multiplyScalar(2 * dist));

  return [mirroredPoint.x, mirroredPoint.y, mirroredPoint.z];
}

/**
 * Calculates the Euclidean distance between two points.
 * @param {Array} posA - The first point as [x, y, z].
 * @param {Array} posB - The second point as [x, y, z].
 * @returns {Number} The distance between posA and posB.
 */
function distanceBetweenPoints(posA, posB) {
  const dx = posA[0] - posB[0];
  const dy = posA[1] - posB[1];
  const dz = posA[2] - posB[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Detects if there are any potential mirror planes aligned with the principal axes (XY, XZ, YZ).
 * @param {Array} points - An array of point objects, each with a 'pos' property as [x, y, z].
 * @param {Number} tolerance - The distance tolerance to consider two points as mirrored.
 * @returns {Array} A list of detected planes with the number of mirrored points.
 */
function detectAxisAlignedMirrorPlanes(points, tolerance = 0.001) {
  const centroid = computeCentroid(points);

  // Define the axis-aligned planes (XY, XZ, YZ) at the centroid.
  const planes = [
    { normal: { x: 0, y: 0, z: 1 }, point: { x: centroid.x, y: centroid.y, z: centroid.z } }, // XY plane
    { normal: { x: 0, y: 1, z: 0 }, point: { x: centroid.x, y: centroid.y, z: centroid.z } }, // XZ plane
    { normal: { x: 1, y: 0, z: 0 }, point: { x: centroid.x, y: centroid.y, z: centroid.z } }, // YZ plane
  ];

  const mirroredResults = [];

  planes.forEach((plane) => {
    let mirroredCount = 0;

    points.forEach((point) => {
      // Mirror the point across the current plane
      const mirroredPoint = mirrorPointAcrossPlane(point.pos, plane.normal, plane.point);

      // Check if there is a matching point in the original dataset
      const hasMirroredPair = points.some(
        (p) => distanceBetweenPoints(p.pos, mirroredPoint) < tolerance
      );

      if (hasMirroredPair) {
        mirroredCount++;
      }
    });

    if (mirroredCount > 3) {
      mirroredResults.push({
        plane,
        mirroredCount,
      });
    }
  });

  return mirroredResults;
}

/**
 * Main function to detect mirror planes from 3D points.
 * First detects axis-aligned planes, then custom PCA planes.
 * Duplicates are removed based on normal vector comparison.
 * @param {Array} points - An array of point objects, each with a 'pos' property as [x, y, z].
 * @param {Number} tolerance - The tolerance to consider two planes as duplicates.
 * @returns {Array} A unique set of mirror planes.
 */
function detectAllMirrorPlanes(points, tolerance = 0.01) {
  // Step 1: Detect axis-aligned planes (XY, XZ, YZ)
  const axisAlignedPlanes = detectAxisAlignedMirrorPlanes(points, tolerance);

  // Step 2: Detect custom mirror planes using PCA
  const pcaMirrorPlanes = calculateMirrorPlanes(points);

  // Step 3: Remove duplicates between PCA planes and axis-aligned planes
  const uniquePlanes = mergeUniquePlanes(axisAlignedPlanes, pcaMirrorPlanes, tolerance);

  return uniquePlanes;
}

/**
 * Merges axis-aligned planes and PCA-calculated planes while removing duplicates.
 * @param {Array} axisAlignedPlanes - List of axis-aligned planes.
 * @param {Array} pcaPlanes - List of PCA-calculated planes.
 * @param {Number} tolerance - The tolerance to consider two planes as duplicates.
 * @returns {Array} A list of unique planes.
 */
function mergeUniquePlanes(axisAlignedPlanes, pcaPlanes, tolerance) {
  const uniquePlanes = [...axisAlignedPlanes];

  pcaPlanes.forEach((pcaPlane) => {
    const isDuplicate = uniquePlanes.some(
      (plane) => arePlanesSimilar(plane, pcaPlane, tolerance)
    );
    if (!isDuplicate) {
      uniquePlanes.push(pcaPlane);
    }
  });

  return uniquePlanes;
}

/**
 * Compares two planes to check if they are similar based on their normal vectors.
 * @param {Object} planeA - The first plane {normal, point}.
 * @param {Object} planeB - The second plane {normal, point}.
 * @param {Number} tolerance - The tolerance for normal vector comparison.
 * @returns {Boolean} True if the planes are similar, false otherwise.
 */
function arePlanesSimilar(planeA, planeB, tolerance) {
  const normalA = new THREE.Vector3(planeA.normal.x, planeA.normal.y, planeA.normal.z).normalize();
  const normalB = new THREE.Vector3(planeB.normal.x, planeB.normal.y, planeB.normal.z).normalize();

  return normalA.distanceTo(normalB) < tolerance || normalA.distanceTo(normalB.negate()) < tolerance;
}

/**
 * Detects if there are any potential mirror planes aligned with the principal axes (XY, XZ, YZ).
 * @param {Array} points - An array of point objects, each with a 'pos' property as [x, y, z].
 * @param {Number} tolerance - The distance tolerance to consider two points as mirrored.
 * @returns {Array} A list of detected planes with the number of mirrored points.
 */
function detectAxisAlignedMirrorPlanes(points, tolerance = 0.001) {
  const centroid = computeCentroid(points);

  // Define the axis-aligned planes (XY, XZ, YZ) at the centroid.
  const planes = [
    { normal: { x: 0, y: 0, z: 1 }, point: { x: centroid.x, y: centroid.y, z: centroid.z } }, // XY plane
    { normal: { x: 0, y: 1, z: 0 }, point: { x: centroid.x, y: centroid.y, z: centroid.z } }, // XZ plane
    { normal: { x: 1, y: 0, z: 0 }, point: { x: centroid.x, y: centroid.y, z: centroid.z } }, // YZ plane
  ];

  const mirroredResults = [];

  planes.forEach((plane) => {
    let mirroredCount = 0;

    points.forEach((point) => {
      // Mirror the point across the current plane
      const mirroredPoint = mirrorPointAcrossPlane(point.pos, plane.normal, plane.point);

      // Check if there is a matching point in the original dataset
      const hasMirroredPair = points.some(
        (p) => distanceBetweenPoints(p.pos, mirroredPoint) < tolerance
      );

      if (hasMirroredPair) {
        mirroredCount++;
      }
    });

    if (mirroredCount > 3) {
      mirroredResults.push({
        normal: plane.normal,
        point: plane.point,
        mirroredCount,
      });
    }
  });

  return mirroredResults;
}