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
    centroid.x += node.pos[0];
    centroid.y += node.pos[1];
    centroid.z += node.pos[2];
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
    node.pos[0] - centroid.x,
    node.pos[1] - centroid.y,
    node.pos[2] - centroid.z,
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