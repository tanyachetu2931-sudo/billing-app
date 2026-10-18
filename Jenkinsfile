
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
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

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

        stage('Build Images') {
            steps {
                sh '''
                    docker build \
                      -t billing-backend:${BUILD_NUMBER} \
                      -t billing-backend:latest ./backend

                    docker build \
                      -t billing-frontend:${BUILD_NUMBER} \
                      -t billing-frontend:latest ./frontend
                '''
            }
        }

        
stage('Publish to ECR') {
    when {
        expression { env.PUBLISH_TO_ECR == 'true' }
    }
    steps {
        script {
            sh '''
                set -eu

                ACCOUNT_ID=$(aws sts get-caller-identity \
                    --query Account --output text)

                REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"

                echo "Logging in to Amazon ECR..."
                aws ecr get-login-password \
                    --region "$AWS_DEFAULT_REGION" |
                    docker login --username AWS \
                    --password-stdin "$REGISTRY"

                echo "Tagging backend image..."
                docker tag "billing-backend:${BUILD_NUMBER}" \
                    "$REGISTRY/billing-app-backend:${BUILD_NUMBER}"
                docker tag "billing-backend:${BUILD_NUMBER}" \
                    "$REGISTRY/billing-app-backend:latest"

                echo "Tagging frontend image..."
                docker tag "billing-frontend:${BUILD_NUMBER}" \
                    "$REGISTRY/billing-app-frontend:${BUILD_NUMBER}"
                docker tag "billing-frontend:${BUILD_NUMBER}" \
                    "$REGISTRY/billing-app-frontend:latest"

                echo "Pushing backend images..."
                docker push "$REGISTRY/billing-app-backend:${BUILD_NUMBER}"
                docker push "$REGISTRY/billing-app-backend:latest"

                echo "Pushing frontend images..."
                docker push "$REGISTRY/billing-app-frontend:${BUILD_NUMBER}"
                docker push "$REGISTRY/billing-app-frontend:latest"

                echo "Both application images pushed successfully."
            '''
        }
    }
}
        stage('Deploy to EKS') {
            when {
                expression {
                    return env.DEPLOY_TO_EKS == 'true'
                }
            }
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-jenkins-credentials'
                ]]) {
                    sh '''
                        set -eu
                        : "${EKS_CLUSTER_NAME:?Set EKS_CLUSTER_NAME in Jenkins}"

                        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
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
            echo 'Pipeline failed. Check the stage logs.'
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
