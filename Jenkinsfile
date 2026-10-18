pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        AWS_DEFAULT_REGION = 'ap-south-1'
        ECR_REPOSITORY = 'billing-app'
        K8S_NAMESPACE = 'billing'
    }

    stages {

        // Stage 1: Get source code from GitHub
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // Stage 2: Validate tools, configuration and backend
        stage('Validate') {
            steps {
                sh 'node --version'
                sh 'npm --version'
                sh 'docker --version'
                sh 'docker compose version'
                sh 'docker compose config -q'
                sh 'node --check backend/src/server.js'
                sh 'npm test --prefix backend'
            }
        }

        // Stage 3: Build backend and frontend Docker images
        stage('Build Images') {
            steps {
                sh '''
                    docker build \
                      -t billing-backend:${BUILD_NUMBER} \
                      -t billing-backend:latest \
                      ./backend

                    docker build \
                      -t billing-frontend:${BUILD_NUMBER} \
                      -t billing-frontend:latest \
                      ./frontend
                '''
            }
        }

        // Stage 4: Publish images to AWS ECR.
        // Enable by setting PUBLISH_TO_ECR=true in Jenkins.
        stage('Publish to ECR') {
            when {
                expression {
                    return env.PUBLISH_TO_ECR == 'true'
                }
            }

            steps {
                withCredentials([
                    [
                        $class: 'AmazonWebServicesCredentialsBinding',
                        credentialsId: 'aws-jenkins-credentials'
                    ]
                ]) {
                    sh '''
                        set -eu

                        ACCOUNT_ID=$(aws sts get-caller-identity \
                          --query Account --output text)

                        REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"

                        for APP in backend frontend; do
                            REPO="${ECR_REPOSITORY}-${APP}"

                            aws ecr describe-repositories \
                              --repository-names "$REPO" \
                              --region "$AWS_DEFAULT_REGION" >/dev/null

                            aws ecr get-login-password \
                              --region "$AWS_DEFAULT_REGION" \
                              | docker login \
                                  --username AWS \
                                  --password-stdin "$REGISTRY"

                            docker tag "billing-${APP}:${BUILD_NUMBER}" \
                              "${REGISTRY}/${REPO}:${BUILD_NUMBER}"

                            docker push "${REGISTRY}/${REPO}:${BUILD_NUMBER}"
                        done
                    '''
                }
            }
        }

        // Stage 5: Deploy updated images to an existing EKS cluster.
        // Enable only after configuring EKS, kubectl, IAM and deployments.
        stage('Deploy to EKS') {
            when {
                expression {
                    return env.DEPLOY_TO_EKS == 'true'
                }
            }

            steps {
                withCredentials([
                    [
                        $class: 'AmazonWebServicesCredentialsBinding',
                        credentialsId: 'aws-jenkins-credentials'
                    ]
                ]) {
                    sh '''
                        set -eu

                        : "${EKS_CLUSTER_NAME:?Set EKS_CLUSTER_NAME in Jenkins}"

                        ACCOUNT_ID=$(aws sts get-caller-identity \
                          --query Account --output text)

                        REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"

                        aws eks update-kubeconfig \
                          --region "$AWS_DEFAULT_REGION" \
                          --name "$EKS_CLUSTER_NAME"

                        kubectl create namespace "$K8S_NAMESPACE" \
                          --dry-run=client -o yaml | kubectl apply -f -

                        kubectl -n "$K8S_NAMESPACE" set image \
                          deployment/billing-backend \
                          "backend=${REGISTRY}/${ECR_REPOSITORY}-backend:${BUILD_NUMBER}"

                        kubectl -n "$K8S_NAMESPACE" set image \
                          deployment/billing-frontend \
                          "frontend=${REGISTRY}/${ECR_REPOSITORY}-frontend:${BUILD_NUMBER}"

                        kubectl -n "$K8S_NAMESPACE" rollout status \
                          deployment/billing-backend --timeout=180s

                        kubectl -n "$K8S_NAMESPACE" rollout status \
                          deployment/billing-frontend --timeout=180s
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Billing application pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Check the stage logs above for the error.'
        }

        always {
            sh 'docker image prune -f || true'
        }
    }
}
